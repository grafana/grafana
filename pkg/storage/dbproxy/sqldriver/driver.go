// Package sqldriver adapts the V1 read-only proxy to database/sql.
package sqldriver

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/authlib/types"
	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

var ErrUnsupported = errors.New("single-tenant database proxy: operation unsupported")
var queryNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_.-]{0,127}$`)

type queryContextKey struct{}
type queryIdentity struct{ namespace, name string }

// WithQuery sets the concrete stack and stable query name for an execution.
func WithQuery(ctx context.Context, namespace, queryName string) context.Context {
	return context.WithValue(ctx, queryContextKey{}, queryIdentity{namespace, queryName})
}

// WithQueryName stores the name for a caller that obtains its stack from another context source.
func WithQueryName(ctx context.Context, queryName string) context.Context {
	identity, _ := ctx.Value(queryContextKey{}).(queryIdentity)
	identity.name = queryName
	return context.WithValue(ctx, queryContextKey{}, identity)
}

// QueryName returns the name supplied by WithQuery or WithQueryName.
func QueryName(ctx context.Context) string {
	identity, _ := ctx.Value(queryContextKey{}).(queryIdentity)
	return identity.name
}

// Driver shares one generated client across lightweight logical connections.
type Driver struct {
	client dbproxyv1.DatabaseProxyServiceClient
}

func New(client dbproxyv1.DatabaseProxyServiceClient) *Driver { return &Driver{client: client} }
func (d *Driver) Open(dsn string) (driver.Conn, error) {
	connector, err := d.OpenConnector(dsn)
	if err != nil {
		return nil, err
	}
	return connector.Connect(context.Background())
}
func (d *Driver) OpenConnector(string) (driver.Connector, error) {
	if d == nil || d.client == nil {
		return nil, errors.New("single-tenant database proxy: nil client")
	}
	return &connector{d}, nil
}

type connector struct{ driver *Driver }

func (c *connector) Connect(ctx context.Context) (driver.Conn, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return &conn{c.driver.client}, nil
}
func (c *connector) Driver() driver.Driver { return c.driver }

type conn struct {
	client dbproxyv1.DatabaseProxyServiceClient
}

func (*conn) Close() error              { return nil }
func (*conn) Begin() (driver.Tx, error) { return nil, ErrUnsupported }
func (*conn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	return nil, ErrUnsupported
}
func (*conn) Ping(context.Context) error                  { return ErrUnsupported }
func (c *conn) Prepare(query string) (driver.Stmt, error) { return &stmt{query: query, conn: c}, nil }
func (c *conn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return &stmt{query: query, conn: c}, nil
}
func (c *conn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	identity, ok := ctx.Value(queryContextKey{}).(queryIdentity)
	if !ok || !validNamespace(identity.namespace) || !queryNamePattern.MatchString(identity.name) {
		return nil, errors.New("single-tenant database proxy: valid stack namespace and query name required")
	}
	if query == "" {
		return nil, errors.New("single-tenant database proxy: empty SQL")
	}
	parameters := make([]*dbproxyv1.Value, 0, len(args))
	for _, arg := range args {
		if arg.Name != "" {
			return nil, errors.New("single-tenant database proxy: named arguments unsupported")
		}
		v, err := parameterValue(arg.Value)
		if err != nil {
			return nil, fmt.Errorf("parameter %d: %w", arg.Ordinal, err)
		}
		parameters = append(parameters, v)
	}
	rpcCtx, cancel := context.WithCancel(ctx)
	stream, err := c.client.Query(rpcCtx, &dbproxyv1.QueryRequest{Namespace: identity.namespace, QueryName: identity.name, Sql: query, Parameters: parameters})
	if err != nil {
		cancel()
		return nil, fmt.Errorf("proxy query: %w", err)
	}
	first, err := stream.Recv()
	if err != nil {
		cancel()
		if errors.Is(err, io.EOF) {
			return nil, errors.New("proxy query: stream ended without schema")
		}
		return nil, fmt.Errorf("proxy query: %w", err)
	}
	if err := validateSchema(first); err != nil {
		cancel()
		return nil, fmt.Errorf("proxy query: %w", err)
	}
	return &rows{columns: first.Columns, stream: stream, cancel: cancel}, nil
}
func (*conn) ExecContext(context.Context, string, []driver.NamedValue) (driver.Result, error) {
	return nil, ErrUnsupported
}
func (*conn) CheckNamedValue(v *driver.NamedValue) error {
	converted, err := convertArgument(v.Value)
	if err != nil {
		return err
	}
	v.Value = converted
	return nil
}

type stmt struct {
	query string
	conn  *conn
}

func (*stmt) Close() error                               { return nil }
func (*stmt) NumInput() int                              { return -1 }
func (*stmt) Exec([]driver.Value) (driver.Result, error) { return nil, ErrUnsupported }
func (*stmt) ExecContext(context.Context, []driver.NamedValue) (driver.Result, error) {
	return nil, ErrUnsupported
}
func (s *stmt) Query(args []driver.Value) (driver.Rows, error) {
	return nil, errors.New("single-tenant database proxy: query context required")
}
func (s *stmt) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	return s.conn.QueryContext(ctx, s.query, args)
}
func (s *stmt) CheckNamedValue(v *driver.NamedValue) error {
	return s.conn.CheckNamedValue(v)
}

func convertArgument(value any) (driver.Value, error) {
	if driver.IsValue(value) {
		return value, nil
	}
	if u, ok := value.(uint64); ok {
		return u, nil
	}
	if valuer, ok := value.(driver.Valuer); ok {
		rv := reflect.ValueOf(valuer)
		if rv.Kind() == reflect.Pointer && rv.IsNil() && rv.Type().Elem().Implements(reflect.TypeFor[driver.Valuer]()) {
			// Calling the generated value-receiver method on a nil pointer would panic; treat it as SQL NULL.
			return nil, nil
		}
		converted, err := valuer.Value()
		if err != nil {
			return nil, err
		}
		if driver.IsValue(converted) {
			return converted, nil
		}
		if u, ok := converted.(uint64); ok {
			return u, nil
		}
		return nil, fmt.Errorf("non-Value type %T returned from Value", converted)
	}
	rv := reflect.ValueOf(value)
	if rv.IsValid() {
		if rv.Kind() == reflect.Pointer {
			if rv.IsNil() {
				return nil, nil
			}
			return convertArgument(rv.Elem().Interface())
		}
		switch rv.Kind() {
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			if rv.Uint() > math.MaxInt64 {
				return rv.Uint(), nil
			}
		default:
			return driver.DefaultParameterConverter.ConvertValue(value)
		}
	}
	return driver.DefaultParameterConverter.ConvertValue(value)
}

func parameterValue(value any) (*dbproxyv1.Value, error) {
	switch v := value.(type) {
	case nil:
		return &dbproxyv1.Value{Kind: &dbproxyv1.Value_NullValue{NullValue: structpb.NullValue_NULL_VALUE}}, nil
	case int64:
		return &dbproxyv1.Value{Kind: &dbproxyv1.Value_Int64Value{Int64Value: v}}, nil
	case uint64:
		return &dbproxyv1.Value{Kind: &dbproxyv1.Value_Uint64Value{Uint64Value: v}}, nil
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return nil, errors.New("non-finite float")
		}
		return &dbproxyv1.Value{Kind: &dbproxyv1.Value_Float64Value{Float64Value: v}}, nil
	case bool:
		return &dbproxyv1.Value{Kind: &dbproxyv1.Value_BoolValue{BoolValue: v}}, nil
	case string:
		return &dbproxyv1.Value{Kind: &dbproxyv1.Value_StringValue{StringValue: v}}, nil
	case []byte:
		if v == nil {
			return &dbproxyv1.Value{Kind: &dbproxyv1.Value_NullValue{NullValue: structpb.NullValue_NULL_VALUE}}, nil
		}
		return &dbproxyv1.Value{Kind: &dbproxyv1.Value_BytesValue{BytesValue: v}}, nil
	case time.Time:
		timestamp := timestamppb.New(v.UTC())
		if err := timestamp.CheckValid(); err != nil {
			return nil, err
		}
		return &dbproxyv1.Value{Kind: &dbproxyv1.Value_TimestampValue{TimestampValue: timestamp}}, nil
	default:
		return nil, fmt.Errorf("unsupported value %T", value)
	}
}
func validateSchema(response *dbproxyv1.QueryResponse) error {
	if response == nil || len(response.Columns) == 0 || len(response.Rows) > 0 || len(response.Warnings) > 0 {
		return errors.New("invalid stream schema")
	}
	for i, col := range response.Columns {
		if col == nil || !knownType(col.ValueType) || col.ValueType == dbproxyv1.ValueType_VALUE_TYPE_UNSPECIFIED {
			return fmt.Errorf("column %d has unknown type", i)
		}
		if col.ValueType == dbproxyv1.ValueType_VALUE_TYPE_NULL && col.Nullable != nil && !*col.Nullable {
			return fmt.Errorf("column %d is nonnullable NULL", i)
		}
		if col.Length != nil && *col.Length < 0 {
			return fmt.Errorf("column %d has negative length", i)
		}
		if size := col.DecimalSize; size != nil && (size.Precision < 0 || size.Scale < 0 || size.Scale > size.Precision) {
			return fmt.Errorf("column %d has invalid decimal size", i)
		}
	}
	return nil
}
func validNamespace(value string) bool {
	ns, err := types.ParseNamespace(value)
	return err == nil && ns.StackID > 0
}
func knownType(v dbproxyv1.ValueType) bool {
	return v >= dbproxyv1.ValueType_VALUE_TYPE_NULL && v <= dbproxyv1.ValueType_VALUE_TYPE_TIMESTAMP
}

type rows struct {
	columns []*dbproxyv1.Column
	stream  grpc.ServerStreamingClient[dbproxyv1.QueryResponse]
	cancel  context.CancelFunc
	batch   []*dbproxyv1.Row
	index   int
	done    bool
}

func (r *rows) Columns() []string {
	out := make([]string, len(r.columns))
	for i, c := range r.columns {
		out[i] = c.Name
	}
	return out
}
func (r *rows) Close() error {
	if !r.done {
		r.done = true
		r.cancel()
	}
	return nil
}
func (r *rows) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	for r.index >= len(r.batch) {
		response, err := r.stream.Recv()
		if err != nil {
			r.done = true
			r.cancel()
			if errors.Is(err, io.EOF) {
				return io.EOF
			}
			return fmt.Errorf("proxy query stream: %w", err)
		}
		if response == nil || len(response.Columns) > 0 || (len(response.Rows) == 0 && len(response.Warnings) == 0) {
			r.done = true
			r.cancel()
			return errors.New("proxy query stream: invalid response after schema")
		}
		r.batch = response.Rows
		r.index = 0
	}
	row := r.batch[r.index]
	r.index++
	if row == nil || len(row.Values) != len(r.columns) {
		r.done = true
		r.cancel()
		return errors.New("proxy query stream: row width differs from schema")
	}
	for i, v := range row.Values {
		converted, err := resultValue(v, r.columns[i])
		if err != nil {
			r.done = true
			r.cancel()
			return fmt.Errorf("proxy query stream column %d: %w", i, err)
		}
		dest[i] = converted
	}
	return nil
}
func resultValue(value *dbproxyv1.Value, col *dbproxyv1.Column) (driver.Value, error) {
	if value == nil || value.Kind == nil {
		return nil, errors.New("missing value kind")
	}
	if v, ok := value.Kind.(*dbproxyv1.Value_NullValue); ok {
		if v.NullValue != structpb.NullValue_NULL_VALUE {
			return nil, errors.New("invalid NULL value")
		}
		if col.Nullable != nil && !*col.Nullable {
			return nil, errors.New("NULL in nonnullable column")
		}
		return nil, nil
	}
	var kind dbproxyv1.ValueType
	var result driver.Value
	switch v := value.Kind.(type) {
	case *dbproxyv1.Value_Int64Value:
		kind = dbproxyv1.ValueType_VALUE_TYPE_INT64
		result = v.Int64Value
	case *dbproxyv1.Value_Uint64Value:
		kind = dbproxyv1.ValueType_VALUE_TYPE_UINT64
		result = []byte(strconv.FormatUint(v.Uint64Value, 10))
	case *dbproxyv1.Value_Float64Value:
		kind = dbproxyv1.ValueType_VALUE_TYPE_FLOAT64
		result = v.Float64Value
	case *dbproxyv1.Value_BoolValue:
		kind = dbproxyv1.ValueType_VALUE_TYPE_BOOL
		result = v.BoolValue
	case *dbproxyv1.Value_StringValue:
		kind = dbproxyv1.ValueType_VALUE_TYPE_STRING
		result = v.StringValue
	case *dbproxyv1.Value_BytesValue:
		kind = dbproxyv1.ValueType_VALUE_TYPE_BYTES
		if v.BytesValue == nil {
			result = []byte{}
		} else {
			result = v.BytesValue
		}
	case *dbproxyv1.Value_TimestampValue:
		kind = dbproxyv1.ValueType_VALUE_TYPE_TIMESTAMP
		if v.TimestampValue == nil {
			return nil, errors.New("missing timestamp")
		}
		if err := v.TimestampValue.CheckValid(); err != nil {
			return nil, fmt.Errorf("invalid timestamp: %w", err)
		}
		result = v.TimestampValue.AsTime().UTC()
	default:
		return nil, errors.New("unknown value kind")
	}
	if kind != col.ValueType {
		return nil, fmt.Errorf("value kind %s differs from column type %s", kind, col.ValueType)
	}
	return result, nil
}
func (r *rows) ColumnTypeDatabaseTypeName(i int) string { return r.columns[i].DatabaseTypeName }
func (r *rows) ColumnTypeNullable(i int) (bool, bool) {
	v := r.columns[i].Nullable
	if v == nil {
		return false, false
	}
	return *v, true
}
func (r *rows) ColumnTypeLength(i int) (int64, bool) {
	v := r.columns[i].Length
	if v == nil {
		return 0, false
	}
	return *v, true
}
func (r *rows) ColumnTypePrecisionScale(i int) (int64, int64, bool) {
	v := r.columns[i].DecimalSize
	if v == nil {
		return 0, 0, false
	}
	return v.Precision, v.Scale, true
}

func (r *rows) ColumnTypeScanType(i int) reflect.Type {
	switch r.columns[i].ValueType {
	case dbproxyv1.ValueType_VALUE_TYPE_INT64:
		return reflect.TypeFor[int64]()
	case dbproxyv1.ValueType_VALUE_TYPE_UINT64, dbproxyv1.ValueType_VALUE_TYPE_BYTES:
		return reflect.TypeFor[[]byte]()
	case dbproxyv1.ValueType_VALUE_TYPE_FLOAT64:
		return reflect.TypeFor[float64]()
	case dbproxyv1.ValueType_VALUE_TYPE_BOOL:
		return reflect.TypeFor[bool]()
	case dbproxyv1.ValueType_VALUE_TYPE_STRING:
		return reflect.TypeFor[string]()
	case dbproxyv1.ValueType_VALUE_TYPE_TIMESTAMP:
		return reflect.TypeFor[time.Time]()
	default:
		return reflect.TypeFor[any]()
	}
}
