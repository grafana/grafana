package sql

import (
	"errors"
	"fmt"
	"io"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/memory"
	gomysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/information_schema"
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
func convertToDataFrame(iter gomysql.RowIter, schema gomysql.Schema) (*data.Frame, error) {
	// Create a new Frame
	frame := data.NewFrame("ResultSet")

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
			return nil, fmt.Errorf("unsupported type for column %s: %v", col.Name, colType)
		}
		frame.Fields = append(frame.Fields, field)
	}

	// Iterate through the rows and append data to fields
	for {
		// TODO: Use a more appropriate context
		row, err := iter.Next(gomysql.NewEmptyContext())
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error reading row: %v", err)
		}

		for i, val := range row {
			switch v := val.(type) {
			case int64:
				frame.Fields[i].Append(v)
			case float64:
				frame.Fields[i].Append(v)
			case string:
				frame.Fields[i].Append(v)
			case bool:
				frame.Fields[i].Append(v)
			// Add more types as needed
			default:
				return nil, fmt.Errorf("unsupported value type for column %s: %T", schema[i].Name, v)
			}
		}
	}

	return frame, nil
}

func (db *DB) QueryFramesInto(name string, query string, frames []*data.Frame, f *data.Frame) error {
	// error if more than zero frames received
	// TODO: Implement loading data into the database later
	if len(frames) > 0 {
		return errors.New("not implemented")
	}

	engine := sqle.NewDefault(
		gomysql.NewDatabaseProvider(
			db.inMemoryDb,
			information_schema.NewInformationSchemaDatabase(),
		))

	ctx := gomysql.NewEmptyContext()

	// TODO - stop overriding the query
	query = `SELECT 'sam' AS 'name', 40 AS 'age';`

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

	f, err = convertToDataFrame(iter, schema)
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
