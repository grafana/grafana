package sql

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/memory"
	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var dbName = "mydb"

type DB struct {
	inMemoryDb *memory.Database
}

func (db *DB) RunCommands(commands []string) (string, error) {
	return "", errors.New("not implemented")
}

// MySQLColToFieldType converts a MySQL column to a data.FieldType
// Fow now that output is always a nullable type
func MySQLColToFieldType(col *mysql.Column) (data.FieldType, error) {
	var fT data.FieldType

	switch col.Type {
	case types.Int64:
		fT = data.FieldTypeInt64
	case types.Float64:
		fT = data.FieldTypeFloat64
	// StringType represents all string types, including VARCHAR and BLOB.
	case types.Text, types.LongText:
		fT = data.FieldTypeString
	case types.Timestamp:
		fT = data.FieldTypeTime
	default:
		return fT, fmt.Errorf("unsupported type for column %s of type %v", col.Name, col.Type)
	}

	// For now output is always nullable type
	fT = fT.NullableType()

	return fT, nil
}

// TODO: Should this accept a row limit and converters, like sqlutil.FrameFromRows?
func convertToDataFrame(ctx *mysql.Context, iter mysql.RowIter, schema mysql.Schema, f *data.Frame) error {
	// Create fields based on the schema
	for _, col := range schema {
		fT, err := MySQLColToFieldType(col)
		if err != nil {
			return err
		}

		field := data.NewFieldFromFieldType(fT, 0)
		field.Name = col.Name
		f.Fields = append(f.Fields, field)
	}

	// Iterate through the rows and append data to fields
	for {
		// TODO: Use a more appropriate context
		row, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("error reading row: %v", err)
		}

		for i, val := range row {
			switch schema[i].Type {
			// TODO: The types listed here should be the same as that
			// used when creating the fields. Am I using the wrong fields
			// from the schema instance?
			case types.Int64:
				if val == nil {
					f.Fields[i].Append((*int64)(nil))
				} else {
					v, ok := val.(int64)
					if !ok {
						return fmt.Errorf("unexpected type for column %s, column type %s, column nullable %v, val type: %T", schema[i].Name, schema[i].Type, schema[i].Nullable, val)
					}
					f.Fields[i].Append(&v)
				}
			case types.Float64:
				if val == nil {
					f.Fields[i].Append((*float64)(nil))
					continue
				}
				vf, ok := val.(*float64)
				if ok {
					f.Fields[i].Append(vf)
					continue
				}
				v, ok := val.(float64)
				if ok {
					f.Fields[i].Append(&v)
					continue
				}
				return fmt.Errorf("unexpected type for column %s, column type %s, column nullable %v, val type: %T", schema[i].Name, schema[i].Type, schema[i].Nullable, val)
			case types.Text, types.LongText:
				if val == nil {
					f.Fields[i].Append((*string)(nil))
					continue
				}
				v, ok := val.(string)
				if ok {
					f.Fields[i].Append(&v)
					continue
				}
				vf, ok := val.(*string)
				if ok {
					f.Fields[i].Append(vf)
					continue
				}
				return fmt.Errorf("unexpected type for column %s, column type %s, column nullable %v, val type: %T", schema[i].Name, schema[i].Type, schema[i].Nullable, val)
			case types.Timestamp:
				if val == nil {
					f.Fields[i].Append((*time.Time)(nil))
				} else {
					v, ok := val.(time.Time)
					if !ok {
						return fmt.Errorf("unexpected type for column %s, column type %s, column nullable %v, val type: %T", schema[i].Name, schema[i].Type, schema[i].Nullable, val)
					}
					f.Fields[i].Append(&v)
				}
			// Add more types as needed
			default:
				return fmt.Errorf("unsupported type for column %s: %v", schema[i].Name, schema[i].Type)
			}
		}
	}

	return nil
}

// TODO: Check if it really makes sense to receive a shared context here, rather than creating a new one
func (db *DB) writeDataframeToDb(ctx *mysql.Context, tableName string, frame *data.Frame) error {
	if frame == nil {
		return fmt.Errorf("input frame is nil")
	}
	tableName = strings.ToLower(frame.RefID)

	// Create schema based on frame fields
	schema := make(mysql.Schema, len(frame.Fields))
	for i, field := range frame.Fields {
		schema[i] = &mysql.Column{
			Name:     field.Name,
			Type:     convertDataType(field.Type()),
			Nullable: field.Type().Nullable(),
			Source:   tableName,
		}
	}

	// Create table with the dynamic schema
	table := memory.NewTable(db.inMemoryDb, tableName, mysql.NewPrimaryKeySchema(schema), nil)
	db.inMemoryDb.AddTable(tableName, table)

	// Insert data from the frame
	for i := 0; i < frame.Rows(); i++ {
		row := make(mysql.Row, len(frame.Fields))
		for j, field := range frame.Fields {
			if schema[j].Nullable {
				if field.At(i) == nil {
					continue
				}
				v, _ := field.ConcreteAt(i)
				row[j] = v
				continue
			}
			row[j] = field.At(i)
		}

		err := table.Insert(ctx, row)
		if err != nil {
			return fmt.Errorf("error inserting row %d: %v", i, err)
		}
	}

	return nil
}

// Helper function to convert data.FieldType to types.Type
func convertDataType(fieldType data.FieldType) mysql.Type {
	switch fieldType {
	case data.FieldTypeInt8, data.FieldTypeInt16, data.FieldTypeInt32, data.FieldTypeInt64, data.FieldTypeNullableInt64:
		return types.Int64
	case data.FieldTypeUint8, data.FieldTypeUint16, data.FieldTypeUint32, data.FieldTypeUint64:
		return types.Uint64
	case data.FieldTypeFloat32, data.FieldTypeFloat64, data.FieldTypeNullableFloat64:
		return types.Float64
	case data.FieldTypeString, data.FieldTypeNullableString:
		return types.Text
	case data.FieldTypeBool:
		return types.Boolean
	case data.FieldTypeTime:
		return types.Timestamp
	default:
		fmt.Printf("------- Unsupported field type: %v", fieldType)
		return types.JSON
	}
}

func (db *DB) QueryFramesInto(tableName string, query string, frames []*data.Frame, f *data.Frame) error {
	// pro := memory.NewDBProvider(db.inMemoryDb)
	// session := memory.NewSession(mysql.NewBaseSession(), pro)
	// ctx := mysql.NewContext(context.Background(), mysql.WithSession(session))

	pro := NewFramesDBProvider(frames)
	session := mysql.NewBaseSession()
	ctx := mysql.NewContext(context.Background(), mysql.WithSession(session))

	// for _, frame := range frames {
	// 	// We have both `frame` and `f` in this function. Consider renaming one or both.
	// 	// Potentially `f` to `outputFrame`
	// 	err := db.writeDataframeToDb(ctx, tableName, frame)
	// 	if err != nil {
	// 		return err
	// 	}
	// }

	// Select the database in the context
	ctx.SetCurrentDatabase(dbName)

	// TODO: Check if it's wise to reuse the existing provider, rather than creating a new one
	engine := sqle.NewDefault(pro)
	// engine := sqle.NewDefault(
	// 	mysql.NewDatabaseProvider(
	// 		db.inMemoryDb,
	// 	))

	schema, iter, _, err := engine.Query(ctx, query)
	if err != nil {
		return err
	}

	// TODO: Implement row limit and converters, as per sqlutil.FrameFromRows
	// rowLimit := int64(1000) // TODO - set the row limit
	// // converters := sqlutil.ConvertersFromSchema(f.RefID, f.Fields)
	// // Use nil converters for now
	// var converters []sqlutil.Converter
	// rows := sqlutil.NewRowIter(mysqlRows, nil)
	// frame, err := sqlutil.FrameFromRows(rows, rowLimit, converters...)

	// TODO: Consider if this should be moved outside of this function
	// or indeed into convertToDataFrame
	f.Name = tableName
	err = convertToDataFrame(ctx, iter, schema, f)
	if err != nil {
		return err
	}

	return nil
}

func NewInMemoryDB() *DB { // TODO - name the function. The InMemoryDB name is now used on line 13
	return &DB{
		inMemoryDb: memory.NewDatabase(dbName), // TODO - change the name of the database
	}
}
