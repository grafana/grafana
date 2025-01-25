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
	if col.Nullable {
		fT = fT.NullableType()
	}

	return fT, nil
}

func fieldValFromRowVal(fieldType data.FieldType, val interface{}) (interface{}, error) {
	// the input val may be nil, it also may not be a pointer even if the fieldtype is a nullable pointer type
	if val == nil {
		return nil, nil
	}
	switch fieldType {
	case data.FieldTypeInt64:
		v, ok := val.(int64)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v, expected int64", val)
		}
		return v, nil

	case data.FieldTypeNullableInt64:
		vP, ok := val.(*int64)
		if ok {
			return vP, nil
		}
		v, ok := val.(int64)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v, expected int64 or *int64", val)

	case data.FieldTypeFloat64:
		v, ok := val.(float64)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v, expected float64", val)
		}
		return v, nil

	case data.FieldTypeNullableFloat64:
		vP, ok := val.(*float64)
		if ok {
			return vP, nil
		}
		v, ok := val.(float64)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v, expected float64 or *float64", val)

	case data.FieldTypeTime:
		v, ok := val.(time.Time)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v, expected time.Time", val)
		}
		return v, nil

	case data.FieldTypeNullableTime:
		vP, ok := val.(*time.Time)
		if ok {
			return vP, nil
		}
		v, ok := val.(time.Time)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v, expected time.Time or *time.Time", val)

	case data.FieldTypeString:
		v, ok := val.(string)
		if !ok {
			return nil, fmt.Errorf("unexpected value type for interface %v, expected string", val)
		}
		return v, nil

	case data.FieldTypeNullableString:
		vP, ok := val.(*string)
		if ok {
			return vP, nil
		}
		v, ok := val.(string)
		if ok {
			return &v, nil
		}
		return nil, fmt.Errorf("unexpected value type for interface %v, expected string or *string", val)

	default:
		return nil, fmt.Errorf("unsupported field type %s for val %v", fieldType, val)
	}
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
			v, err := fieldValFromRowVal(f.Fields[i].Type(), val)
			if err != nil {
				return fmt.Errorf("unexpected type for column %s: %w", schema[i].Name, err)
			}
			f.Fields[i].Append(v)
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
