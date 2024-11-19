package sql

import (
	"errors"
	"fmt"
	"io"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/memory"
	gomysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/information_schema"
	"github.com/dolthub/go-mysql-server/sql/types"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type DB struct {
	inMemoryDb *memory.Database
}

func (db *DB) TablesList(rawSQL string) ([]string, error) {
	return nil, errors.New("not implemented")
}

func (db *DB) RunCommands(commands []string) (string, error) {
	return "", errors.New("not implemented")
}

// TODO: Should this accept a row limit and converters, like sqlutil.FrameFromRows?
func convertToDataFrame(iter gomysql.RowIter, schema gomysql.Schema, f *data.Frame) error {
	// Create fields based on the schema
	for _, col := range schema {
		var field *data.Field
		// switch col.Type.Type() {
		switch colType := col.Type.(type) {
		// NumberType represents all integer and floating point types
		// TODO: branch between int and float
		case gomysql.NumberType:
			field = data.NewField(col.Name, nil, []int64{})
		// StringType represents all string types, including VARCHAR and BLOB.
		case gomysql.StringType:
			field = data.NewField(col.Name, nil, []string{})
		// TODO: Implement the following types
		// DatetimeType represents DATE, DATETIME, and TIMESTAMP.
		// YearType represents the YEAR type.
		// SetType represents the SET type.
		// EnumType represents the ENUM type.
		// DecimalType represents the DECIMAL type.
		// Also the NullType (and DeferredType) ?

		// case int8:
		// 	field = data.NewField(col.Name, nil, []int64{})
		default:
			return fmt.Errorf("unsupported type for column %s: %v", col.Name, colType)
		}
		f.Fields = append(f.Fields, field)
	}

	// Iterate through the rows and append data to fields
	for {
		// TODO: Use a more appropriate context
		row, err := iter.Next(gomysql.NewEmptyContext())
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("error reading row: %v", err)
		}

		for i, val := range row {
			switch v := val.(type) {
			// TODO: The types listed here should be the same as that
			// used when creating the fields. Am I using the wrong fields
			// from the schema instance?
			case int8:
				f.Fields[i].Append(int64(v))
			case int64:
				f.Fields[i].Append(v)
			case float64:
				f.Fields[i].Append(v)
			case string:
				f.Fields[i].Append(v)
			case bool:
				f.Fields[i].Append(v)
			// Add more types as needed
			default:
				return fmt.Errorf("unsupported value type for column %s: %T", schema[i].Name, v)
			}
		}
	}

	return nil
}

// TODO: Rename `name` to `tableName`?
func (db *DB) QueryFramesInto(name string, query string, frames []*data.Frame, f *data.Frame) error {
	// TODO: Consider if this should be moved outside of this function
	// or indeed into convertToDataFrame
	f.Name = name

	// TODO: Extract this into a function
	// TODO: Check these details:
	// - Do we need a primary key?
	// - Can we omit `Nullable` and `Source`?
	table := memory.NewTable(db.inMemoryDb, name, gomysql.NewPrimaryKeySchema(gomysql.Schema{
		// https://pkg.go.dev/github.com/dolthub/go-mysql-server/sql#Column
		{Name: "name", Type: types.Text, Nullable: false, Source: name},
		{Name: "profession", Type: types.Text, Nullable: false, Source: name},
	}), nil)

	db.inMemoryDb.AddTable(name, table)
	// TODO: Use a more appropriate context
	err := table.Insert(gomysql.NewEmptyContext(), gomysql.NewRow("sam", "engineer"))
	if err != nil {
		return fmt.Errorf("error inserting row: %v", err)
	}
	// END TODO: extract

	engine := sqle.NewDefault(
		gomysql.NewDatabaseProvider(
			db.inMemoryDb,
			information_schema.NewInformationSchemaDatabase(),
		))

	ctx := gomysql.NewEmptyContext()

	schema, iter, _, err := engine.Query(ctx, query)
	if err != nil {
		return err
	}

	// rowLimit := int64(1000) // TODO - set the row limit

	// // converters := sqlutil.ConvertersFromSchema(f.RefID, f.Fields)
	// // Use nil converters for now
	// var converters []sqlutil.Converter

	// rows := sqlutil.NewRowIter(mysqlRows, nil)
	// frame, err := sqlutil.FrameFromRows(rows, rowLimit, converters...)

	err = convertToDataFrame(iter, schema, f)
	if err != nil {
		return err
	}

	return nil
}

func NewInMemoryDB() *DB { // TODO - name the function. The InMemoryDB name is now used on line 13
	return &DB{
		inMemoryDb: memory.NewDatabase("test"), // TODO - change the name of the database
	}
}
