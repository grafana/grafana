package sql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/infra/log"
	duckdb "github.com/marcboeker/go-duckdb"
)

var (
	logger = log.New("expr")
)

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
		lookup: Fields{},
	}, nil
}

// Query runs a query against DuckDB
func (d *DuckDB) Query(ctx context.Context, query string) (*data.Frame, error) {
	results, err := d.db.Query(query)
	if err != nil {
		fmt.Printf("failed to query db: %v\n", err)
		return nil, err
	}

	defer func() {
		err := results.Close()
		if err != nil {
			fmt.Println("failed to close query results")
		}
	}()

	// TODO - add any needed converters for duckdb?
	frame, err := sqlutil.FrameFromRows(results, -1, DuckConverters...)
	if err != nil {
		err := results.Close()
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
	fieldLookup := fields(frames)
	unknown, err := d.createTables(ctx, frames, fieldLookup)
	if err != nil {
		return err
	}

	err = d.appendFrames(ctx, frames, unknown, fieldLookup)
	if err != nil {
		return err
	}

	return nil
}

func (d *DuckDB) createTables(ctx context.Context, frames data.Frames, fieldLookup TableFields) (Unknown, error) {
	unknown := Unknown{}

	for id, tableFields := range fieldLookup {
		name := id
		stmt := []string{}
		stmt = append(stmt, fmt.Sprintf("create or replace table %s (", name))
		var fields []string
		for _, fld := range tableFields {
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

		err = res.Close()
		if err != nil {
			return nil, err
		}
	}
	return unknown, nil
}

// appendFrames - takes dataframes and appends the values into DuckDB
func (d *DuckDB) appendFrames(ctx context.Context, f data.Frames, u Unknown, fl TableFields) error {
	conn, err := d.db.Conn(ctx)
	if err != nil {
		return err
	}
	err = conn.Raw(func(driverConn any) error {
		c, ok := driverConn.(driver.Conn)
		if !ok {
			return errors.New("bad connection")
		}
		return d.doAppend(c, f, u, fl)
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

func (d *DuckDB) doAppend(c driver.Conn, frames data.Frames, u Unknown, fl TableFields) error {
	tables, nullFields := buildTables(frames, fl, u)
	for name, t := range tables {

		appender, err := duckdb.NewAppenderFromConn(c, "", name)
		if err != nil {
			return err
		}

		for _, row := range t {
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

		err = appender.Close()
		if err != nil {
			fmt.Println(err)
			return err
		}
	}

	return d.updateNullPlaceholders(nullFields)
}
