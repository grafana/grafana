package sql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	duckdb "github.com/marcboeker/go-duckdb"
)

// DuckDB stores dataframes from previous datasource queries
// and allows querying using SQL Expressions in Grafana
type DuckDB struct {
	db     *sql.DB
	name   string
	lookup map[string]*data.Field
}

// NewInMemoryDB creates a new in-memory DuckDB
func NewInMemoryDB(ctx context.Context) (*DuckDB, error) {
	return NewDuckDB(ctx, "")
}

// NewDuckDB creates a new DuckDB.  For in-memory set name to ""
func NewDuckDB(ctx context.Context, name string) (*DuckDB, error) {
	connector, err := connector(ctx, name)
	if err != nil {
		return nil, err
	}
	db := sql.OpenDB(connector)
	db.SetMaxOpenConns(2)

	return &DuckDB{
		db:     db,
		name:   name,
		lookup: make(map[string]*data.Field),
	}, nil
}

func (d *DuckDB) Query(ctx context.Context, query string) (*data.Frame, error) {
	results, err := d.db.Query(query)
	if err != nil {
		fmt.Printf("failed to query db: %v\n", err)
		return nil, err
	}
	defer results.Close()

	// TODO - add any needed converters for duckdb?
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

	for _, f := range frames {
		err := d.appendFrame(ctx, f)
		if err != nil {
			return err
		}
	}

	return nil
}

func (d *DuckDB) createTables(ctx context.Context, frames data.Frames) error {
	for _, f := range frames {
		name := tableName(f)
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
				createTable += " " + "VARCHAR"
				found = true
			}
			if fld.Type() == data.FieldTypeNullableJSON || fld.Type() == data.FieldTypeJSON {
				createTable += " " + "VARCHAR"
				found = true
			}
			if !found {
				// TODO - surely this will cause a problem.
				// Throw an error here?  Or track this and don't insert here. Then log a warning?
				createTable += " " + "VARCHAR"
			}
			sep = " ,"

			// Keep a map of the input field names
			if len(fld.Labels) > 0 || fld.Config != nil {
				d.lookup[fld.Name] = fld
			}
		}
		createTable += ")"

		res, err := d.db.Query(createTable)
		if err != nil {
			fmt.Println(err)
			return err
		}
		defer res.Close()
	}
	return nil
}

func (d *DuckDB) appendFrame(ctx context.Context, f *data.Frame) error {
	conn, err := d.db.Conn(ctx)
	if err != nil {
		return err
	}
	err = conn.Raw(func(driverConn any) error {
		c, ok := driverConn.(driver.Conn)
		if !ok {
			return errors.New("bad connection")
		}
		return d.doAppend(c, f)
	})
	if err != nil {
		return err
	}

	return nil
}

func connector(ctx context.Context, name string) (driver.Connector, error) {
	connector, err := duckdb.NewConnector(name, func(execer driver.ExecerContext) error {
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
	return connector, err
}

func (d *DuckDB) doAppend(c driver.Conn, f *data.Frame) error {
	appender, err := duckdb.NewAppenderFromConn(c, "", tableName(f))
	if err != nil {
		return err
	}
	for i := 0; i < f.Rows(); i++ {
		var row []driver.Value
		for _, ff := range f.Fields {
			val := ff.At(i)
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

	return nil
}

func tableName(f *data.Frame) string {
	if f.RefID != "" {
		return f.RefID
	}
	return f.Name
}
