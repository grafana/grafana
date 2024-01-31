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
	"github.com/grafana/grafana/pkg/infra/log"
	duckdb "github.com/marcboeker/go-duckdb"
)

var (
	logger = log.New("expr")
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

// Query runs a query against DuckDB
func (d *DuckDB) Query(ctx context.Context, query string) (*data.Frame, error) {
	results, err := d.db.Query(query)
	if err != nil {
		fmt.Printf("failed to query db: %v\n", err)
		return nil, err
	}
	defer results.Close()

	// TODO - add any needed converters for duckdb?
	frame, err := sqlutil.FrameFromRows(results, -1, DuckConverters...)
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

// AppendAll converts all the data frames into DuckDB tables
func (d *DuckDB) AppendAll(ctx context.Context, frames data.Frames) error {
	unknown, err := d.createTables(ctx, frames)
	if err != nil {
		return err
	}

	for _, f := range frames {
		err := d.appendFrame(ctx, f, unknown)
		if err != nil {
			return err
		}
	}

	return nil
}

func (d *DuckDB) createTables(ctx context.Context, frames data.Frames) (Unknown, error) {
	unknown := Unknown{}

	for _, f := range frames {
		name := tableName(f)
		stmt := []string{}
		stmt = append(stmt, fmt.Sprintf("create or replace table %s (", name))
		var fields []string
		for _, fld := range f.Fields {
			var field []string

			n := fld.Name
			if strings.ContainsAny(n, "- :,#@") || (n[0] >= '0' && n[0] <= '9') {
				n = fmt.Sprintf(`"%s"`, n) // escape the string
			}
			field = append(field, n)

			found := false
			if fld.Type() == data.FieldTypeBool || fld.Type() == data.FieldTypeNullableBool {
				field = append(field, " BOOLEAN")
				found = true
			}
			if fld.Type() == data.FieldTypeFloat32 || fld.Type() == data.FieldTypeFloat64 || fld.Type() == data.FieldTypeNullableFloat32 || fld.Type() == data.FieldTypeNullableFloat64 {
				field = append(field, " DOUBLE")
				found = true
			}
			if fld.Type() == data.FieldTypeInt8 || fld.Type() == data.FieldTypeInt16 || fld.Type() == data.FieldTypeInt32 || fld.Type() == data.FieldTypeNullableInt8 || fld.Type() == data.FieldTypeNullableInt16 || fld.Type() == data.FieldTypeNullableInt32 {
				field = append(field, " INTEGER")
				found = true
			}
			if fld.Type() == data.FieldTypeInt64 || fld.Type() == data.FieldTypeNullableInt64 {
				field = append(field, " BIGINT")
				found = true
			}
			if fld.Type() == data.FieldTypeUint8 || fld.Type() == data.FieldTypeUint16 || fld.Type() == data.FieldTypeUint32 || fld.Type() == data.FieldTypeNullableUint8 || fld.Type() == data.FieldTypeNullableUint16 || fld.Type() == data.FieldTypeNullableUint32 {
				field = append(field, " UINTEGER")
				found = true
			}
			if fld.Type() == data.FieldTypeUint64 || fld.Type() == data.FieldTypeNullableUint64 {
				field = append(field, " UBIGINT")
				found = true
			}
			if fld.Type() == data.FieldTypeString || fld.Type() == data.FieldTypeNullableString {
				field = append(field, " VARCHAR")
				found = true
			}
			if fld.Type() == data.FieldTypeTime || fld.Type() == data.FieldTypeNullableTime {
				field = append(field, " TIMESTAMP")
				found = true
			}
			if fld.Type() == data.FieldTypeUnknown {
				field = append(field, " VARCHAR")
				found = true
			}
			if fld.Type() == data.FieldTypeNullableJSON || fld.Type() == data.FieldTypeJSON {
				field = append(field, " VARCHAR")
				found = true
			}
			if found {
				fields = append(fields, strings.Join(field, ""))
			} else {
				// could not determine field type
				unknown[fld.Name] = true
				logger.Warn("could not determine datatype for %s: %s", fld.Name, fld.Type().String())
			}

			// Keep a map of the input field names
			if len(fld.Labels) > 0 || fld.Config != nil {
				d.lookup[fld.Name] = fld
			}
		}
		stmt = append(stmt, strings.Join(fields, " ,"))
		stmt = append(stmt, ")")

		res, err := d.db.Query(strings.Join(stmt, ""))
		if err != nil {
			return nil, err
		}
		defer res.Close()
	}
	return unknown, nil
}

func (d *DuckDB) appendFrame(ctx context.Context, f *data.Frame, u Unknown) error {
	conn, err := d.db.Conn(ctx)
	if err != nil {
		return err
	}
	err = conn.Raw(func(driverConn any) error {
		c, ok := driverConn.(driver.Conn)
		if !ok {
			return errors.New("bad connection")
		}
		return d.doAppend(c, f, u)
	})
	if err != nil {
		return err
	}

	return nil
}

func connector(ctx context.Context, name string) (driver.Connector, error) {
	connector, err := duckdb.NewConnector(name, func(execer driver.ExecerContext) error {
		// TODO - extensions - slows down the initialization of DuckDB a bit installing these
		// should we add a setting in the ini file. comma separated list?

		// bootQueries := []string{
		// 	"INSTALL 'json'",
		// 	"LOAD 'json'",
		// }

		// for _, qry := range bootQueries {
		// 	_, err := execer.ExecContext(ctx, qry, nil)
		// 	if err != nil {
		// 		return err
		// 	}
		// }
		return nil
	})
	return connector, err
}

func (d *DuckDB) doAppend(c driver.Conn, f *data.Frame, u Unknown) error {
	appender, err := duckdb.NewAppenderFromConn(c, "", tableName(f))
	if err != nil {
		return err
	}
	for i := 0; i < f.Rows(); i++ {
		var row []driver.Value
		for _, ff := range f.Fields {
			if u[ff.Name] {
				continue
			}
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

type Unknown map[string]bool
