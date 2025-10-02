package pgx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MetaKeyExecutedQueryString is the key where the executed query should get stored
const MetaKeyExecutedQueryString = "executedQueryString"

// SQLMacroEngine interpolates macros into sql. It takes in the Query to have access to query context and
// timeRange to be able to generate queries that use from and to.
type SQLMacroEngine interface {
	Interpolate(query *backend.DataQuery, timeRange backend.TimeRange, sql string) (string, error)
}

// SqlQueryResultTransformer transforms a query result row to RowValues with proper types.
type SqlQueryResultTransformer interface {
	// TransformQueryError transforms a query error.
	TransformQueryError(logger log.Logger, err error) error
	GetConverterList() []sqlutil.StringConverter
}

type JsonData struct {
	MaxOpenConns            int    `json:"maxOpenConns"`
	MaxIdleConns            int    `json:"maxIdleConns"`
	ConnMaxLifetime         int    `json:"connMaxLifetime"`
	ConnectionTimeout       int    `json:"connectionTimeout"`
	Timescaledb             bool   `json:"timescaledb"`
	Mode                    string `json:"sslmode"`
	ConfigurationMethod     string `json:"tlsConfigurationMethod"`
	TlsSkipVerify           bool   `json:"tlsSkipVerify"`
	RootCertFile            string `json:"sslRootCertFile"`
	CertFile                string `json:"sslCertFile"`
	CertKeyFile             string `json:"sslKeyFile"`
	Timezone                string `json:"timezone"`
	Encrypt                 string `json:"encrypt"`
	Servername              string `json:"servername"`
	TimeInterval            string `json:"timeInterval"`
	Database                string `json:"database"`
	SecureDSProxy           bool   `json:"enableSecureSocksProxy"`
	SecureDSProxyUsername   string `json:"secureSocksProxyUsername"`
	AllowCleartextPasswords bool   `json:"allowCleartextPasswords"`
	AuthenticationType      string `json:"authenticationType"`
}

type DataPluginConfiguration struct {
	DSInfo            sqleng.DataSourceInfo
	TimeColumnNames   []string
	MetricColumnTypes []string
	RowLimit          int64
}

type DataSourceHandler struct {
	macroEngine            SQLMacroEngine
	queryResultTransformer SqlQueryResultTransformer
	timeColumnNames        []string
	metricColumnTypes      []string
	log                    log.Logger
	dsInfo                 sqleng.DataSourceInfo
	rowLimit               int64
	userError              string
	pool                   *pgxpool.Pool
}

type QueryJson struct {
	RawSql       string  `json:"rawSql"`
	Fill         bool    `json:"fill"`
	FillInterval float64 `json:"fillInterval"`
	FillMode     string  `json:"fillMode"`
	FillValue    float64 `json:"fillValue"`
	Format       string  `json:"format"`
}

func (e *DataSourceHandler) TransformQueryError(logger log.Logger, err error) error {
	// OpError is the error type usually returned by functions in the net
	// package. It describes the operation, network type, and address of
	// an error. We log this error rather than return it to the client
	// for security purposes.
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		return fmt.Errorf("failed to connect to server - %s", e.userError)
	}

	return e.queryResultTransformer.TransformQueryError(logger, err)
}

func NewQueryDataHandler(userFacingDefaultError string, p *pgxpool.Pool, config DataPluginConfiguration, queryResultTransformer SqlQueryResultTransformer,
	macroEngine SQLMacroEngine, log log.Logger) (*DataSourceHandler, error) {
	queryDataHandler := DataSourceHandler{
		queryResultTransformer: queryResultTransformer,
		macroEngine:            macroEngine,
		timeColumnNames:        []string{"time"},
		log:                    log,
		dsInfo:                 config.DSInfo,
		rowLimit:               config.RowLimit,
		userError:              userFacingDefaultError,
	}

	if len(config.TimeColumnNames) > 0 {
		queryDataHandler.timeColumnNames = config.TimeColumnNames
	}

	if len(config.MetricColumnTypes) > 0 {
		queryDataHandler.metricColumnTypes = config.MetricColumnTypes
	}

	queryDataHandler.pool = p
	return &queryDataHandler, nil
}

type DBDataResponse struct {
	dataResponse backend.DataResponse
	refID        string
}

func (e *DataSourceHandler) Dispose() {
	e.log.Debug("Disposing DB...")

	if e.pool != nil {
		e.pool.Close()
	}

	e.log.Debug("DB disposed")
}

func (e *DataSourceHandler) Ping(ctx context.Context) error {
	return e.pool.Ping(ctx)
}

func (e *DataSourceHandler) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	ch := make(chan DBDataResponse, len(req.Queries))
	var wg sync.WaitGroup
	// Execute each query in a goroutine and wait for them to finish afterwards
	for _, query := range req.Queries {
		queryjson := QueryJson{
			Fill:   false,
			Format: "time_series",
		}
		err := json.Unmarshal(query.JSON, &queryjson)
		if err != nil {
			return nil, backend.DownstreamErrorf("error unmarshal query json: %s", err.Error())
		}

		// the fill-params are only stored inside this function, during query-interpolation. we do not support
		// sending them in "from the outside"
		if queryjson.Fill || queryjson.FillInterval != 0.0 || queryjson.FillMode != "" || queryjson.FillValue != 0.0 {
			return nil, backend.DownstreamErrorf("query fill-parameters not supported")
		}

		if queryjson.RawSql == "" {
			continue
		}

		wg.Add(1)
		go e.executeQuery(ctx, query, &wg, ch, queryjson)
	}

	wg.Wait()

	// Read results from channels
	close(ch)
	result.Responses = make(map[string]backend.DataResponse)
	for queryResult := range ch {
		result.Responses[queryResult.refID] = queryResult.dataResponse
	}

	return result, nil
}

func (e *DataSourceHandler) handleQueryError(frameErr string, err error, query string, source backend.ErrorSource, ch chan DBDataResponse, queryResult DBDataResponse) {
	var emptyFrame data.Frame
	emptyFrame.SetMeta(&data.FrameMeta{ExecutedQueryString: query})
	if isDownstreamError(err) {
		source = backend.ErrorSourceDownstream
	}
	queryResult.dataResponse.Error = fmt.Errorf("%s: %w", frameErr, err)
	queryResult.dataResponse.ErrorSource = source
	queryResult.dataResponse.Frames = data.Frames{&emptyFrame}
	ch <- queryResult
}

func (e *DataSourceHandler) handlePanic(logger log.Logger, queryResult *DBDataResponse, ch chan DBDataResponse) {
	if r := recover(); r != nil {
		logger.Error("ExecuteQuery panic", "error", r, "stack", string(debug.Stack()))
		if theErr, ok := r.(error); ok {
			queryResult.dataResponse.Error = theErr
			queryResult.dataResponse.ErrorSource = backend.ErrorSourcePlugin
		} else if theErrString, ok := r.(string); ok {
			queryResult.dataResponse.Error = errors.New(theErrString)
			queryResult.dataResponse.ErrorSource = backend.ErrorSourcePlugin
		} else {
			queryResult.dataResponse.Error = fmt.Errorf("unexpected error - %s", e.userError)
			queryResult.dataResponse.ErrorSource = backend.ErrorSourceDownstream
		}
		ch <- *queryResult
	}
}

// Interpolate provides global macros/substitutions for all sql datasources.
var Interpolate = func(query backend.DataQuery, timeRange backend.TimeRange, timeInterval string, sql string) string {
	interval := query.Interval

	sql = strings.ReplaceAll(sql, "$__interval_ms", strconv.FormatInt(interval.Milliseconds(), 10))
	sql = strings.ReplaceAll(sql, "$__interval", gtime.FormatInterval(interval))
	sql = strings.ReplaceAll(sql, "$__unixEpochFrom()", fmt.Sprintf("%d", timeRange.From.UTC().Unix()))
	sql = strings.ReplaceAll(sql, "$__unixEpochTo()", fmt.Sprintf("%d", timeRange.To.UTC().Unix()))

	return sql
}

func (e *DataSourceHandler) execQuery(ctx context.Context, query string) ([]*pgconn.Result, error) {
	c, err := e.pool.Acquire(ctx)
	if err != nil {
		return nil, backend.DownstreamErrorf("failed to acquire connection: %w", err)
	}
	defer c.Release()

	mrr := c.Conn().PgConn().Exec(ctx, query)
	// Close returns the first error that occurred during the MultiResultReader's use. We will log that later.
	defer mrr.Close() //nolint:errcheck
	return mrr.ReadAll()
}

func (e *DataSourceHandler) executeQuery(queryContext context.Context, query backend.DataQuery, wg *sync.WaitGroup,
	ch chan DBDataResponse, queryJSON QueryJson) {
	defer wg.Done()
	queryResult := DBDataResponse{
		dataResponse: backend.DataResponse{},
		refID:        query.RefID,
	}

	logger := e.log.FromContext(queryContext)
	defer e.handlePanic(logger, &queryResult, ch)

	if queryJSON.RawSql == "" {
		panic("Query model property rawSql should not be empty at this point")
	}

	// global substitutions
	interpolatedQuery := Interpolate(query, query.TimeRange, e.dsInfo.JsonData.TimeInterval, queryJSON.RawSql)

	// data source specific substitutions
	interpolatedQuery, err := e.macroEngine.Interpolate(&query, query.TimeRange, interpolatedQuery)
	if err != nil {
		e.handleQueryError("interpolation failed", e.TransformQueryError(logger, err), interpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
		return
	}

	results, err := e.execQuery(queryContext, interpolatedQuery)
	if err != nil {
		e.handleQueryError("db query error", e.TransformQueryError(logger, err), interpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
		return
	}

	qm, err := e.newProcessCfg(queryContext, query, results, interpolatedQuery)
	if err != nil {
		e.handleQueryError("failed to get configurations", err, interpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
		return
	}

	frame, err := convertResultsToFrame(results, e.rowLimit)
	if err != nil {
		e.handleQueryError("convert frame from rows error", err, interpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
		return
	}

	e.processFrame(frame, qm, queryResult, ch, logger)
}

// dataQueryFormat is the type of query.
type dataQueryFormat string

const (
	// dataQueryFormatTable identifies a table query (default).
	dataQueryFormatTable dataQueryFormat = "table"
	// dataQueryFormatSeries identifies a time series query.
	dataQueryFormatSeries dataQueryFormat = "time_series"
)

type dataQueryModel struct {
	InterpolatedQuery string // property not set until after Interpolate()
	Format            dataQueryFormat
	TimeRange         backend.TimeRange
	FillMissing       *data.FillMissing // property not set until after Interpolate()
	Interval          time.Duration
	columnNames       []string
	columnTypes       []string
	timeIndex         int
	timeEndIndex      int
	metricIndex       int
	metricPrefix      bool
	queryContext      context.Context
}

func convertSQLTimeColumnsToEpochMS(frame *data.Frame, qm *dataQueryModel) error {
	if qm.timeIndex != -1 {
		if err := convertSQLTimeColumnToEpochMS(frame, qm.timeIndex); err != nil {
			return fmt.Errorf("%v: %w", "failed to convert time column", err)
		}
	}

	if qm.timeEndIndex != -1 {
		if err := convertSQLTimeColumnToEpochMS(frame, qm.timeEndIndex); err != nil {
			return fmt.Errorf("%v: %w", "failed to convert timeend column", err)
		}
	}

	return nil
}

func (e *DataSourceHandler) processFrame(frame *data.Frame, qm *dataQueryModel, queryResult DBDataResponse, ch chan DBDataResponse, logger log.Logger) {
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.ExecutedQueryString = qm.InterpolatedQuery

	// If no rows were returned, clear any previously set `Fields` with a single empty `data.Field` slice.
	// Then assign `queryResult.dataResponse.Frames` the current single frame with that single empty Field.
	// This assures 1) our visualization doesn't display unwanted empty fields, and also that 2)
	// additionally-needed frame data stays intact and is correctly passed to our visulization.
	if frame.Rows() == 0 {
		frame.Fields = []*data.Field{}
		queryResult.dataResponse.Frames = data.Frames{frame}
		ch <- queryResult
		return
	}

	if err := convertSQLTimeColumnsToEpochMS(frame, qm); err != nil {
		e.handleQueryError("converting time columns failed", err, qm.InterpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
		return
	}

	if qm.Format == dataQueryFormatSeries {
		// time series has to have time column
		if qm.timeIndex == -1 {
			e.handleQueryError("db has no time column", errors.New("time column is missing; make sure your data includes a time column for time series format or switch to a table format that doesn't require it"), qm.InterpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
			return
		}

		// Make sure to name the time field 'Time' to be backward compatible with Grafana pre-v8.
		frame.Fields[qm.timeIndex].Name = data.TimeSeriesTimeFieldName

		for i := range qm.columnNames {
			if i == qm.timeIndex || i == qm.metricIndex {
				continue
			}

			if t := frame.Fields[i].Type(); t == data.FieldTypeString || t == data.FieldTypeNullableString {
				continue
			}

			var err error
			if frame, err = convertSQLValueColumnToFloat(frame, i); err != nil {
				e.handleQueryError("convert value to float failed", err, qm.InterpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
				return
			}
		}

		tsSchema := frame.TimeSeriesSchema()
		if tsSchema.Type == data.TimeSeriesTypeLong {
			var err error
			originalData := frame
			frame, err = data.LongToWide(frame, qm.FillMissing)
			if err != nil {
				e.handleQueryError("failed to convert long to wide series when converting from dataframe", err, qm.InterpolatedQuery, backend.ErrorSourceDownstream, ch, queryResult)
				return
			}

			// Before 8x, a special metric column was used to name time series. The LongToWide transforms that into a metric label on the value field.
			// But that makes series name have both the value column name AND the metric name. So here we are removing the metric label here and moving it to the
			// field name to get the same naming for the series as pre v8
			if len(originalData.Fields) == 3 {
				for _, field := range frame.Fields {
					if len(field.Labels) == 1 { // 7x only supported one label
						name, ok := field.Labels["metric"]
						if ok {
							field.Name = name
							field.Labels = nil
						}
					}
				}
			}
		}
		if qm.FillMissing != nil {
			// we align the start-time
			startUnixTime := qm.TimeRange.From.Unix() / int64(qm.Interval.Seconds()) * int64(qm.Interval.Seconds())
			alignedTimeRange := backend.TimeRange{
				From: time.Unix(startUnixTime, 0),
				To:   qm.TimeRange.To,
			}

			var err error
			frame, err = sqlutil.ResampleWideFrame(frame, qm.FillMissing, alignedTimeRange, qm.Interval)
			if err != nil {
				logger.Error("Failed to resample dataframe", "err", err)
				frame.AppendNotices(data.Notice{Text: "Failed to resample dataframe", Severity: data.NoticeSeverityWarning})
				return
			}
		}
	}

	queryResult.dataResponse.Frames = data.Frames{frame}
	ch <- queryResult
}

func (e *DataSourceHandler) newProcessCfg(queryContext context.Context, query backend.DataQuery,
	results []*pgconn.Result, interpolatedQuery string) (*dataQueryModel, error) {
	columnNames := []string{}
	columnTypes := []string{}

	// The results will contain column information in the metadata
	for _, result := range results {
		// Get column names from the result metadata
		for _, field := range result.FieldDescriptions {
			columnNames = append(columnNames, field.Name)
			pqtype, ok := pgtype.NewMap().TypeForOID(field.DataTypeOID)
			if !ok {
				// Handle special cases for field types
				switch field.DataTypeOID {
				case pgtype.TimetzOID:
					columnTypes = append(columnTypes, "timetz")
				case 790:
					columnTypes = append(columnTypes, "money")
				default:
					columnTypes = append(columnTypes, "unknown")
				}
			} else {
				columnTypes = append(columnTypes, pqtype.Name)
			}
		}
	}

	qm := &dataQueryModel{
		columnTypes:  columnTypes,
		columnNames:  columnNames,
		timeIndex:    -1,
		timeEndIndex: -1,
		metricIndex:  -1,
		metricPrefix: false,
		queryContext: queryContext,
	}

	queryJSON := QueryJson{}
	err := json.Unmarshal(query.JSON, &queryJSON)
	if err != nil {
		return nil, err
	}

	if queryJSON.Fill {
		qm.FillMissing = &data.FillMissing{}
		qm.Interval = time.Duration(queryJSON.FillInterval * float64(time.Second))
		switch strings.ToLower(queryJSON.FillMode) {
		case "null":
			qm.FillMissing.Mode = data.FillModeNull
		case "previous":
			qm.FillMissing.Mode = data.FillModePrevious
		case "value":
			qm.FillMissing.Mode = data.FillModeValue
			qm.FillMissing.Value = queryJSON.FillValue
		default:
		}
	}

	qm.TimeRange.From = query.TimeRange.From.UTC()
	qm.TimeRange.To = query.TimeRange.To.UTC()

	// Default to time_series if no format is provided
	switch queryJSON.Format {
	case "table":
		qm.Format = dataQueryFormatTable
	case "time_series":
		fallthrough
	default:
		qm.Format = dataQueryFormatSeries
	}

	for i, col := range qm.columnNames {
		for _, tc := range e.timeColumnNames {
			if col == tc {
				qm.timeIndex = i
				break
			}
		}

		if qm.Format == dataQueryFormatTable && strings.EqualFold(col, "timeend") {
			qm.timeEndIndex = i
			continue
		}

		switch col {
		case "metric":
			qm.metricIndex = i
		default:
			if qm.metricIndex == -1 {
				columnType := qm.columnTypes[i]
				for _, mct := range e.metricColumnTypes {
					if columnType == mct {
						qm.metricIndex = i
						continue
					}
				}
			}
		}
	}
	qm.InterpolatedQuery = interpolatedQuery
	return qm, nil
}

func convertResultsToFrame(results []*pgconn.Result, rowLimit int64) (*data.Frame, error) {
	m := pgtype.NewMap()

	// Find the first SELECT result to establish the frame structure
	var firstSelectResult *pgconn.Result
	for _, result := range results {
		if result.CommandTag.Select() {
			firstSelectResult = result
			break
		}
	}

	// If no SELECT results found, return empty frame
	if firstSelectResult == nil {
		return data.NewFrame(""), nil
	}

	// Create frame structure based on the first SELECT result
	fields := make(data.Fields, len(firstSelectResult.FieldDescriptions))
	fieldTypes, err := getFieldTypesFromDescriptions(firstSelectResult.FieldDescriptions, m)
	if err != nil {
		return nil, err
	}

	for i, v := range firstSelectResult.FieldDescriptions {
		fields[i] = data.NewFieldFromFieldType(fieldTypes[i], 0)
		fields[i].Name = v.Name
	}
	frame := *data.NewFrame("", fields...)

	// Process all SELECT results, but validate column compatibility
	for _, result := range results {
		// Skip non-select statements
		if !result.CommandTag.Select() {
			continue
		}

		// Validate that this result has the same structure as the frame
		if len(result.FieldDescriptions) != len(frame.Fields) {
			return nil, fmt.Errorf("incompatible result structure: expected %d columns, got %d columns",
				len(frame.Fields), len(result.FieldDescriptions))
		}

		// Validate column names and types match
		for i, fd := range result.FieldDescriptions {
			if fd.Name != frame.Fields[i].Name {
				return nil, fmt.Errorf("column name mismatch at position %d: expected %q, got %q",
					i, frame.Fields[i].Name, fd.Name)
			}
		}

		fieldDescriptions := result.FieldDescriptions
		for rowIdx := range result.Rows {
			if rowIdx == int(rowLimit) {
				frame.AppendNotices(data.Notice{
					Severity: data.NoticeSeverityWarning,
					Text:     fmt.Sprintf("Results have been limited to %v because the SQL row limit was reached", rowLimit),
				})
				break
			}
			row := make([]any, len(fieldDescriptions))
			for colIdx, fd := range fieldDescriptions {
				rawValue := result.Rows[rowIdx][colIdx]

				if rawValue == nil {
					row[colIdx] = nil
					continue
				}

				convertedValue, err := convertPostgresValue(rawValue, fd, m)
				if err != nil {
					return nil, err
				}
				row[colIdx] = convertedValue
			}

			// Validate row length matches frame field count before appending
			if len(row) != len(frame.Fields) {
				return nil, fmt.Errorf("row data length mismatch: expected %d values, got %d values",
					len(frame.Fields), len(row))
			}

			frame.AppendRow(row...)
		}
	}

	return &frame, nil
}

// convertPostgresValue converts a raw PostgreSQL value to the appropriate Go type
func convertPostgresValue(rawValue []byte, fd pgconn.FieldDescription, m *pgtype.Map) (interface{}, error) {
	dataTypeOID := fd.DataTypeOID
	format := fd.Format

	// Convert based on type
	switch fd.DataTypeOID {
	case pgtype.Int2OID:
		var d *int16
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		return d, nil
	case pgtype.Int4OID:
		var d *int32
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		return d, nil
	case pgtype.Int8OID:
		var d *int64
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		return d, nil
	case pgtype.NumericOID, pgtype.Float8OID, pgtype.Float4OID:
		var d *float64
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		return d, nil
	case pgtype.BoolOID:
		var d *bool
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		return d, nil
	case pgtype.ByteaOID:
		d, err := pgtype.ByteaCodec.DecodeValue(pgtype.ByteaCodec{}, m, dataTypeOID, format, rawValue)
		if err != nil {
			return nil, err
		}
		str := string(d.([]byte))
		return &str, nil
	case pgtype.TimestampOID, pgtype.TimestamptzOID, pgtype.DateOID:
		var d *time.Time
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		return d, nil
	case pgtype.TimeOID, pgtype.TimetzOID:
		var d *string
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		return d, nil
	case pgtype.JSONOID, pgtype.JSONBOID:
		var d *string
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		// Handle null JSON values
		if d == nil {
			return nil, nil
		}
		j := json.RawMessage(*d)
		return &j, nil
	default:
		var d *string
		scanPlan := m.PlanScan(dataTypeOID, format, &d)
		err := scanPlan.Scan(rawValue, &d)
		if err != nil {
			return nil, err
		}
		return d, nil
	}
}

func getFieldTypesFromDescriptions(fieldDescriptions []pgconn.FieldDescription, m *pgtype.Map) ([]data.FieldType, error) {
	fieldTypes := make([]data.FieldType, len(fieldDescriptions))
	for i, v := range fieldDescriptions {
		typeName, ok := m.TypeForOID(v.DataTypeOID)
		if !ok {
			fieldTypes[i] = data.FieldTypeNullableString
		} else {
			switch typeName.Name {
			case "int2":
				fieldTypes[i] = data.FieldTypeNullableInt16
			case "int4":
				fieldTypes[i] = data.FieldTypeNullableInt32
			case "int8":
				fieldTypes[i] = data.FieldTypeNullableInt64
			case "float4", "float8", "numeric":
				fieldTypes[i] = data.FieldTypeNullableFloat64
			case "bool":
				fieldTypes[i] = data.FieldTypeNullableBool
			case "timestamptz", "timestamp", "date":
				fieldTypes[i] = data.FieldTypeNullableTime
			case "json", "jsonb":
				fieldTypes[i] = data.FieldTypeNullableJSON
			default:
				fieldTypes[i] = data.FieldTypeNullableString
			}
		}
	}
	return fieldTypes, nil
}

// convertSQLTimeColumnToEpochMS converts column named time to unix timestamp in milliseconds
// to make native datetime types and epoch dates work in annotation and table queries.
func convertSQLTimeColumnToEpochMS(frame *data.Frame, timeIndex int) error {
	if timeIndex < 0 || timeIndex >= len(frame.Fields) {
		return fmt.Errorf("timeIndex %d is out of range", timeIndex)
	}

	origin := frame.Fields[timeIndex]
	valueType := origin.Type()
	if valueType == data.FieldTypeTime || valueType == data.FieldTypeNullableTime {
		return nil
	}

	newField := data.NewFieldFromFieldType(data.FieldTypeNullableTime, 0)
	newField.Name = origin.Name
	newField.Labels = origin.Labels

	valueLength := origin.Len()
	for i := 0; i < valueLength; i++ {
		v, err := origin.NullableFloatAt(i)
		if err != nil {
			return fmt.Errorf("unable to convert data to a time field")
		}
		if v == nil {
			newField.Append(nil)
		} else {
			timestamp := time.Unix(0, int64(epochPrecisionToMS(*v))*int64(time.Millisecond))
			newField.Append(&timestamp)
		}
	}
	frame.Fields[timeIndex] = newField

	return nil
}

// convertSQLValueColumnToFloat converts timeseries value column to float.
func convertSQLValueColumnToFloat(frame *data.Frame, Index int) (*data.Frame, error) {
	if Index < 0 || Index >= len(frame.Fields) {
		return frame, fmt.Errorf("metricIndex %d is out of range", Index)
	}

	origin := frame.Fields[Index]
	valueType := origin.Type()
	if valueType == data.FieldTypeFloat64 || valueType == data.FieldTypeNullableFloat64 {
		return frame, nil
	}

	newField := data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, origin.Len())
	newField.Name = origin.Name
	newField.Labels = origin.Labels

	for i := 0; i < origin.Len(); i++ {
		v, err := origin.NullableFloatAt(i)
		if err != nil {
			return frame, err
		}
		newField.Set(i, v)
	}

	frame.Fields[Index] = newField

	return frame, nil
}

// epochPrecisionToMS converts epoch precision to millisecond, if needed.
// Only seconds to milliseconds supported right now
func epochPrecisionToMS(value float64) float64 {
	s := strconv.FormatFloat(value, 'e', -1, 64)
	if strings.HasSuffix(s, "e+09") {
		return value * float64(1e3)
	}

	if strings.HasSuffix(s, "e+18") {
		return value / float64(time.Millisecond)
	}

	return value
}

func isDownstreamError(err error) bool {
	if backend.IsDownstreamError(err) {
		return true
	}
	resultProcessingDownstreamErrors := []error{
		data.ErrorInputFieldsWithoutRows,
		data.ErrorSeriesUnsorted,
		data.ErrorNullTimeValues,
	}
	for _, e := range resultProcessingDownstreamErrors {
		if errors.Is(err, e) {
			return true
		}
	}
	return false
}
