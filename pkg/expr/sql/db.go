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

func (db *DB) TablesList(rawSQL string) ([]string, error) {
	return nil, errors.New("not implemented")
}

func (db *DB) RunCommands(commands []string) (string, error) {
	return "", errors.New("not implemented")
}

// TODO: Should this accept a row limit and converters, like sqlutil.FrameFromRows?
func convertToDataFrame(ctx *mysql.Context, iter mysql.RowIter, schema mysql.Schema, f *data.Frame) error {
	// Create fields based on the schema
	for _, col := range schema {
		var field *data.Field
		switch col.Type {
		// NumberType represents all integer and floating point types
		// TODO: branch between int and float
		case types.Int64:
			field = data.NewField(col.Name, nil, []*int64{})
		case types.Float64:
			field = data.NewField(col.Name, nil, []*float64{})
		// StringType represents all string types, including VARCHAR and BLOB.
		case types.Text:
			field = data.NewField(col.Name, nil, []*string{})
		case types.Timestamp:
			field = data.NewField(col.Name, nil, []*time.Time{})
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
			return fmt.Errorf("unsupported type for column %s: %v", col.Name, col.Type)
		}
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
						return fmt.Errorf("unexpected type for column %s: %T", schema[i].Name, val)
					}
					f.Fields[i].Append(&v)
				}
			case types.Float64:
				if val == nil {
					f.Fields[i].Append((*float64)(nil))
				} else {
					v, ok := val.(float64)
					if !ok {
						return fmt.Errorf("unexpected type for column %s: %T", schema[i].Name, val)
					}
					f.Fields[i].Append(&v)
				}
			case types.Text:
				if val == nil {
					f.Fields[i].Append((*string)(nil))
				} else {
					v, ok := val.(string)
					if !ok {
						return fmt.Errorf("unexpected type for column %s: %T", schema[i].Name, val)
					}
					f.Fields[i].Append(&v)
				}
			case types.Timestamp:
				if val == nil {
					f.Fields[i].Append((*time.Time)(nil))
				} else {
					v, ok := val.(time.Time)
					if !ok {
						return fmt.Errorf("unexpected type for column %s: %T", schema[i].Name, val)
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

func labelsToFields(frame *data.Frame) *data.Frame {
	// Create a result frame with the same name and meta as the input frame
	result := data.NewFrame(frame.Name)
	result.Meta = frame.Meta
	result.RefID = frame.RefID

	for _, fld := range frame.Fields {
		if fld.Labels == nil {
			result.Fields = append(result.Fields, fld)
		} else {
			for lbl, val := range fld.Labels {
				newFld := newField(lbl, val, frame.Rows())
				result.Fields = append(result.Fields, newFld)
			}
			// // Now remove the labels from the original field
			fld.Labels = nil // TODO: Don't mutate the original DataFrame's fields
			result.Fields = append(result.Fields, fld)
		}
	}
	return result
}

func newField(name string, val string, size int) *data.Field {
	values := make([]string, size)
	newField := data.NewField(name, nil, values)
	for i := 0; i < size; i++ {
		newField.Set(i, val)
	}
	return newField
}

func framesKeyedByRefID(frames []*data.Frame) map[string][]*data.Frame {
	keyed := make(map[string][]*data.Frame)
	for _, frame := range frames {
		keyed[frame.RefID] = append(keyed[frame.RefID], frame)
	}
	return keyed
}

func normalizeSchemas(frames []*data.Frame) {
	fields := map[string]*data.Field{}
	for _, f := range frames {
		for _, fld := range f.Fields {
			fields[fld.Name] = fld
		}
	}
	for _, fld := range fields {
		for _, f := range frames {
			found := false
			for _, fld2 := range f.Fields {
				if fld2.Name == fld.Name {
					found = true
					break
				}
			}
			if !found {
				makeArray := maker[fld.Type()]
				arr := makeArray(f.Rows())
				nullField := data.NewField(fld.Name, fld.Labels, arr)
				f.Fields = append(f.Fields, nullField)
			}
		}
	}
}

var maker = map[data.FieldType]func(length int) any{
	data.FieldTypeFloat64:         func(length int) any { return makeArray[float64](length) },
	data.FieldTypeFloat32:         func(length int) any { return makeArray[float32](length) },
	data.FieldTypeInt16:           func(length int) any { return makeArray[int16](length) },
	data.FieldTypeInt64:           func(length int) any { return makeArray[int64](length) },
	data.FieldTypeInt8:            func(length int) any { return makeArray[int8](length) },
	data.FieldTypeUint8:           func(length int) any { return makeArray[uint8](length) },
	data.FieldTypeUint16:          func(length int) any { return makeArray[uint16](length) },
	data.FieldTypeUint32:          func(length int) any { return makeArray[uint32](length) },
	data.FieldTypeUint64:          func(length int) any { return makeArray[uint64](length) },
	data.FieldTypeNullableFloat64: func(length int) any { return makeArray[*float64](length) },
	data.FieldTypeNullableFloat32: func(length int) any { return makeArray[*float32](length) },
	data.FieldTypeNullableInt16:   func(length int) any { return makeArray[*int16](length) },
	data.FieldTypeNullableInt64:   func(length int) any { return makeArray[*int64](length) },
	data.FieldTypeNullableInt8:    func(length int) any { return makeArray[*int8](length) },
	data.FieldTypeNullableUint8:   func(length int) any { return makeArray[*uint8](length) },
	data.FieldTypeNullableUint16:  func(length int) any { return makeArray[*uint16](length) },
	data.FieldTypeNullableUint32:  func(length int) any { return makeArray[*uint32](length) },
	data.FieldTypeNullableUint64:  func(length int) any { return makeArray[*uint64](length) },
	data.FieldTypeString:          func(length int) any { return makeArray[string](length) },
	data.FieldTypeNullableString:  func(length int) any { return makeArray[*string](length) },
	data.FieldTypeTime:            func(length int) any { return makeArray[time.Time](length) },
	data.FieldTypeNullableTime:    func(length int) any { return makeArray[*time.Time](length) },
}

func makeArray[T any](length int) []T {
	return make([]T, length)
}

func (db *DB) QueryFramesInto(tableName string, query string, frames []*data.Frame, f *data.Frame) error {
	pro := memory.NewDBProvider(db.inMemoryDb)
	session := memory.NewSession(mysql.NewBaseSession(), pro)
	ctx := mysql.NewContext(context.Background(), mysql.WithSession(session))

	// SSE may have "mutilated" the DataFrames from long to multi format
	// Before we write to the database, we convert back to long format

	// create a slice of DataFrames to hold the converted DataFrames
	var convertedFrames []*data.Frame

	for _, frame := range frames {
		// Clone DataFrames to avoid modifying the originals
		// copy := clone(frame)

		// convert fields' labels to fields
		copy := labelsToFields(frame)

		// txt, err := copy.StringTable(-1, -1)
		// if err != nil {
		// 	return err
		// }

		// fmt.Printf("GOT: %s", txt)

		convertedFrames = append(convertedFrames, copy)
	}

	framesByRef := framesKeyedByRefID(convertedFrames)

	for _, singleRefFrames := range framesByRef {
		// Convert from `multi-numeric` to `long` by merging frames that share the same refID
		normalizeSchemas(singleRefFrames)

		// Create db table only for the first normalizedFrame
		// subsequent frames will have their rows inserted into the table
		// TODO: Guard against nil or zero-length slice here
		normalizedFrame := singleRefFrames[0]
		if normalizedFrame == nil {
			return fmt.Errorf("input normalizedFrame is nil")
		}
		tableName = strings.ToLower(normalizedFrame.RefID)

		// Create schema based on normalizedFrame fields
		schema := make(mysql.Schema, len(normalizedFrame.Fields))
		for i, field := range normalizedFrame.Fields {
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

		for _, normalizedFrame := range singleRefFrames {
			if normalizedFrame == nil {
				return fmt.Errorf("input normalizedFrame is nil")
			}

			// Insert data from the normalizedFrame
			for i := 0; i < normalizedFrame.Rows(); i++ {
				row := make(mysql.Row, len(normalizedFrame.Fields))
				for j, field := range normalizedFrame.Fields {
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
		}
	}

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
