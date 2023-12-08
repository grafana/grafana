package prql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	duckdb "github.com/marcboeker/go-duckdb"
)

type DuckDB struct {
	// TODO - might need this if/when we change to in memory database
	// for now creates/connects to a file using "name"
	// db     *sql.DB
	conn   driver.Connector
	name   string
	lookup map[string]*data.Field
}

func NewDuckDB(name string) (*DuckDB, error) {
	return &DuckDB{
		name:   name,
		lookup: make(map[string]*data.Field),
	}, nil
}

func (d *DuckDB) QueryPRQL(ctx context.Context, prql string) (*data.Frame, error) {
	prql = strings.ToLower(prql)
	prql = strings.TrimSpace(prql)
	if strings.HasPrefix(prql, "select") || strings.HasPrefix(prql, "with") {
		// assume sql
		return d.Query(ctx, prql)
	}
	sql, err := Convert(prql, "duckdb")
	if err != nil {
		// TODO... should check for first non-comment token?
		// if !strings.Contains(strings.ToLower(prql), "select") {
		// 	return nil, err
		// }
		fmt.Println("failed to compile prql")
		fmt.Println(err.Error())
		// sql = prql // just try it as regular query (will also have a syntax error)
		return nil, err
	}
	return d.Query(ctx, sql)
}

func (d *DuckDB) Query(ctx context.Context, query string) (*data.Frame, error) {
	results, err := d.runQuery(ctx, query)
	if err != nil {
		fmt.Printf("failed to query db: %v\n", err)
		return nil, err
	}

	// TODO - add any needed converters for duckdb
	frame, err := sqlutil.FrameFromRows(results, -1, sqlutil.Converter{})
	if err != nil {
		return nil, err
	}

	// Copy of the input metadata
	for _, field := range frame.Fields {
		match, ok := d.lookup[field.Name]
		if ok && match != nil {
			field.Labels = match.Labels
			field.Config = match.Config
		}
	}

	// Attach the executed query string
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.ExecutedQueryString = query

	return frame, err
}

func (d *DuckDB) AppendAll(ctx context.Context, frames data.Frames) error {
	err := d.createTables(ctx, frames)
	if err != nil {
		return err
	}

	conn, err := d.connect(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	for _, f := range frames {
		name := f.RefID
		if name == "" {
			name = f.Name
		}
		appender, err := duckdb.NewAppenderFromConn(conn, "", name)
		if err != nil {
			return err
		}
		for i := 0; i < f.Rows(); i++ {
			var row []driver.Value
			for _, ff := range f.Fields {
				val := ff.At(i)
				// if isPointer(val) {
				// 	val = getPointerValue(val)
				// }
				// TODO - is there a way to use generics here?
				switch v := val.(type) {
				case *float64:
					val = *v
				case *float32:
					val = *v
				case *string:
					val = *v
				case *int:
					val = *v
				case *int8:
					val = *v
				case *int32:
					val = *v
				case *int64:
					val = *v
				case *uint:
					val = *v
				case *uint8:
					val = *v
				case *uint16:
					val = *v
				case *uint32:
					val = *v
				case *uint64:
					val = *v
				case *bool:
					val = *v
				case *time.Time:
					val = *v
				case *json.RawMessage:
					vv := *v
					val = string(vv)
				case json.RawMessage:
					val = string(v)
				}
				row = append(row, val)
			}
			err := appender.AppendRow(row...)
			if err != nil {
				fmt.Println(err)
				return err
			}
		}

		err = appender.Flush()
		if err != nil {
			fmt.Println(err)
			return err
		}
	}

	return nil
}

func (d *DuckDB) createTables(ctx context.Context, frames data.Frames) error {

	for _, f := range frames {
		name := f.RefID
		if name == "" {
			name = f.Name
		}
		fmt.Println("creating table " + name)
		createTable := "create or replace table " + name + " ("
		sep := ""
		for _, fld := range f.Fields {
			createTable += sep
			n := fld.Name
			if strings.ContainsAny(n, "- :,#@") {
				n = fmt.Sprintf(`"%s"`, n) // escape the string
			}
			createTable += n
			found := false
			if fld.Type() == data.FieldTypeBool || fld.Type() == data.FieldTypeNullableBool {
				createTable += " " + "BOOLEAN"
				found = true
			}
			if fld.Type() == data.FieldTypeFloat32 || fld.Type() == data.FieldTypeFloat64 || fld.Type() == data.FieldTypeNullableFloat32 || fld.Type() == data.FieldTypeNullableFloat64 {
				createTable += " " + "DOUBLE"
				found = true
			}
			if fld.Type() == data.FieldTypeInt8 || fld.Type() == data.FieldTypeInt16 || fld.Type() == data.FieldTypeInt32 || fld.Type() == data.FieldTypeNullableInt8 || fld.Type() == data.FieldTypeNullableInt16 || fld.Type() == data.FieldTypeNullableInt32 {
				createTable += " " + "INTEGER"
				found = true
			}
			if fld.Type() == data.FieldTypeInt64 || fld.Type() == data.FieldTypeNullableInt64 {
				createTable += " " + "BIGINT"
				found = true
			}
			if fld.Type() == data.FieldTypeUint8 || fld.Type() == data.FieldTypeUint16 || fld.Type() == data.FieldTypeUint32 || fld.Type() == data.FieldTypeNullableUint8 || fld.Type() == data.FieldTypeNullableUint16 || fld.Type() == data.FieldTypeNullableUint32 {
				createTable += " " + "UINTEGER"
				found = true
			}
			if fld.Type() == data.FieldTypeUint64 || fld.Type() == data.FieldTypeNullableUint64 {
				createTable += " " + "UBIGINT"
				found = true
			}
			if fld.Type() == data.FieldTypeString || fld.Type() == data.FieldTypeNullableString {
				createTable += " " + "VARCHAR"
				found = true
			}
			if fld.Type() == data.FieldTypeTime || fld.Type() == data.FieldTypeNullableTime {
				createTable += " " + "TIMESTAMP"
				found = true
			}
			if fld.Type() == data.FieldTypeUnknown {
				createTable += " " + "BLOB"
				found = true
			}
			if fld.Type() == data.FieldTypeNullableJSON || fld.Type() == data.FieldTypeJSON {
				createTable += " " + "VARCHAR"
				found = true
			}
			if !found {
				// TODO - surely this will cause a problem
				createTable += " " + "VARCHAR"
			}
			sep = " ,"

			// Keep a map of the input field names
			if len(fld.Labels) > 0 || fld.Config != nil {
				d.lookup[fld.Name] = fld
			}
		}
		createTable += ")"
		fmt.Println(createTable)

		_, err := d.runQuery(ctx, createTable)
		if err != nil {
			fmt.Println(err)
			return err
		}
	}
	return nil
}

// connect returns a connector for the appender
func (d *DuckDB) connect(ctx context.Context) (driver.Conn, error) {
	connector, err := d.connector(ctx)
	if err != nil {
		return nil, err
	}
	conn, err := connector.Connect(ctx)
	if err != nil {
		return nil, err
	}
	return conn, nil
}

func (d *DuckDB) connector(ctx context.Context) (driver.Connector, error) {
	if d.conn == nil {
		connector, err := duckdb.NewConnector(d.name, func(execer driver.ExecerContext) error {
			// If `INSTALL 'json'` here fails, try running duckdb from the command line, and running
			// `INSTALL 'json'` from there instead.
			bootQueries := []string{
				"INSTALL 'json'",
				"LOAD 'json'",
			}

			for _, qry := range bootQueries {
				_, err := execer.ExecContext(ctx, qry, nil)
				if err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			d.conn = connector
		}
		return connector, err
	}
	return d.conn, nil
}

func (d *DuckDB) runQuery(ctx context.Context, query string) (*sql.Rows, error) {
	connector, err := d.connector(ctx)
	if err != nil {
		return nil, err
	}
	db := sql.OpenDB(connector)
	defer func() {
		err = db.Close()
		if err != nil {
			fmt.Printf("failed to close db after query: %v\n", err)
		}
	}()

	results, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("failed to query db: %v\n", err)
		return nil, err
	}
	return results, nil
}
