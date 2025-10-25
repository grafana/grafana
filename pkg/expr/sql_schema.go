package expr

import (
	"context"
	"reflect"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/sql"
)

// BasicColumn represents the column type for data that is input to a SQL expression.
type BasicColumn struct {
	Name               string         `json:"name"`
	MySQLType          string         `json:"mysqlType"`
	Nullable           bool           `json:"nullable"`
	DataFrameFieldType data.FieldType `json:"dataFrameFieldType"`
}

// SchemaInfo provides information and some sample data for data that could be an input
// to a SQL expression.
type SchemaInfo struct {
	Columns    []BasicColumn `json:"columns"`
	SampleRows [][]any       `json:"sampleRows"`
	Error      string        `json:"error,omitempty"`
}

// SQLSchemas returns info about what the Schema for a DS query will be like if the
// query were to be used an input to SQL expressions. So effectively post SQL expressions input
// conversion.
// There is a a manual DeepCopy at the end of this file that will need to be updated when this our the
// underlying structs are change. The hack script will also need to be run to update the Query service API
// generated types.
type SQLSchemas map[string]SchemaInfo

// GetSQLSchemas returns what the schemas are for SQL expressions for all DS queries
// in the request. It executes the queries to get the schemas.
// Intended use is for autocomplete and AI, so used during the authoring/editing experience only.
func (s *Service) GetSQLSchemas(ctx context.Context, req Request) (SQLSchemas, error) {
	// Extract DS Nodes and Execute Them
	// Building the pipeline is maybe not best, as it can have more errors.
	filtered := make([]Query, 0, len(req.Queries))
	for _, q := range req.Queries {
		if NodeTypeFromDatasourceUID(q.DataSource.UID) == TypeDatasourceNode {
			filtered = append(filtered, q)
		}
	}
	req.Queries = filtered
	pipeline, err := s.buildPipeline(ctx, &req)
	if err != nil {
		return nil, err
	}

	var schemas = make(SQLSchemas)

	for _, node := range pipeline {
		// For now, execute calls convert at the end, so we are being lazy and running the full conversion. Longer run we want to run without
		// full conversion and just get the schema. Maybe conversion should be
		dsNode := node.(*DSNode)
		// Make all input to SQL
		dsNode.isInputToSQLExpr = true

		// TODO: check where time is coming from, don't recall
		res, err := dsNode.Execute(ctx, time.Now(), mathexp.Vars{}, s)
		if err != nil {
			schemas[dsNode.RefID()] = SchemaInfo{Error: err.Error()}
			continue
			// we want to continue and get the schemas we can
		}
		if res.Error != nil {
			schemas[dsNode.RefID()] = SchemaInfo{Error: res.Error.Error()}
			continue
			// we want to continue and get the schemas we can
		}

		frames := res.Values.AsDataFrames(dsNode.RefID())
		if len(frames) == 0 {
			schemas[dsNode.RefID()] = SchemaInfo{Error: "no data"}
		}
		frame := frames[0]

		schema := sql.SchemaFromFrame(frame)
		columns := make([]BasicColumn, 0, len(schema))
		for _, col := range schema {
			fT, _ := sql.MySQLColToFieldType(col)
			columns = append(columns, BasicColumn{
				Name:               col.Name,
				MySQLType:          col.Type.String(),
				Nullable:           col.Nullable,
				DataFrameFieldType: fT,
			})
		}

		// Cap at 3 rows.
		const maxRows = 3
		n := frame.Rows()
		if n > maxRows {
			n = maxRows
		}
		sampleRows := make([][]any, 0, n)
		for i := 0; i < n; i++ {
			sampleRows = append(sampleRows, frame.RowCopy(i))
		}

		schemas[dsNode.RefID()] = SchemaInfo{Columns: columns, SampleRows: sampleRows}
	}

	return schemas, nil
}

// DeepCopy returns a deep copy of the schema.
// Used AI to make it, the kubernetes one doesn't like any or interface{}
func (s SQLSchemas) DeepCopy() SQLSchemas {
	if s == nil {
		return nil
	}
	out := make(SQLSchemas, len(s))
	for k, v := range s {
		out[k] = SchemaInfo{
			Columns:    copyColumns(v.Columns),
			SampleRows: deepCopySampleRows2D(v.SampleRows),
			Error:      v.Error,
		}
	}
	return out
}

func copyColumns(in []BasicColumn) []BasicColumn {
	if in == nil {
		return nil
	}
	out := make([]BasicColumn, len(in))
	copy(out, in) // BasicColumn is value-only, so this suffices
	return out
}

// Deep-copy [][]any preserving nil vs empty slices and cloning elements.
func deepCopySampleRows2D(in [][]any) [][]any {
	if in == nil {
		return nil
	}
	out := make([][]any, len(in))
	for i, row := range in {
		if row == nil {
			// preserve nil inner slice
			continue
		}
		newRow := make([]any, len(row))
		for j, v := range row {
			newRow[j] = deepCopyAny(v)
		}
		out[i] = newRow
	}
	return out
}

// Recursively clone pointers, maps, slices, arrays, and interfaces.
// Structs are copied by value (shallow for their internals).
func deepCopyAny(v any) any {
	if v == nil {
		return nil
	}
	return deepCopyRV(reflect.ValueOf(v)).Interface()
}

func deepCopyRV(rv reflect.Value) reflect.Value {
	if !rv.IsValid() {
		return rv
	}

	switch rv.Kind() {
	case reflect.Ptr:
		if rv.IsNil() {
			return rv
		}
		elemCopy := deepCopyRV(rv.Elem())
		newPtr := reflect.New(rv.Type().Elem())
		if elemCopy.Type().AssignableTo(newPtr.Elem().Type()) {
			newPtr.Elem().Set(elemCopy)
		} else if elemCopy.Type().ConvertibleTo(newPtr.Elem().Type()) {
			newPtr.Elem().Set(elemCopy.Convert(newPtr.Elem().Type()))
		} else {
			newPtr.Elem().Set(rv.Elem()) // fallback: shallow
		}
		return newPtr

	case reflect.Interface:
		if rv.IsNil() {
			return rv
		}
		return deepCopyRV(rv.Elem())

	case reflect.Map:
		if rv.IsNil() {
			return reflect.Zero(rv.Type())
		}
		newMap := reflect.MakeMapWithSize(rv.Type(), rv.Len())
		for _, k := range rv.MapKeys() {
			newMap.SetMapIndex(deepCopyRV(k), deepCopyRV(rv.MapIndex(k)))
		}
		return newMap

	case reflect.Slice:
		if rv.IsNil() {
			return reflect.Zero(rv.Type())
		}
		n := rv.Len()
		newSlice := reflect.MakeSlice(rv.Type(), n, n)
		for i := 0; i < n; i++ {
			newSlice.Index(i).Set(deepCopyRV(rv.Index(i)))
		}
		return newSlice

	case reflect.Array:
		n := rv.Len()
		newArr := reflect.New(rv.Type()).Elem()
		for i := 0; i < n; i++ {
			newArr.Index(i).Set(deepCopyRV(rv.Index(i)))
		}
		return newArr

	case reflect.Struct:
		// Value copy (OK unless the struct contains references you also want deep-copied).
		return rv

	default:
		// Scalars (string, bool, numbers), etc.
		return rv
	}
}
