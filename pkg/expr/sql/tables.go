package sql

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// buildTables builds a structure to be appended to DuckDB
func buildTables(frames data.Frames, fl TableFields, u Unknown) (Tables, Fields) {
	var nullFields = Fields{}
	var tables = Tables{}

	for _, f := range frames {
		tableFields := fl[f.RefID]

		var fieldMap = Fields{}
		for _, ff := range f.Fields {
			fieldMap[ff.Name] = ff
		}

		for i := 0; i < f.Rows(); i++ {
			var row []driver.Value
			for _, tf := range tableFields {
				ff := fieldMap[tf.Name]
				if ff != nil {
					if u[ff.Name] {
						continue
					}
					val := ff.At(i)
					switch v := val.(type) {
					case *float64:
						val = *v
					case float64:
						val = v
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
				} else {
					// this columns doesn't exist in this frame.  just make it null
					// TODO - workaround - check type and set appropriate placeholder
					// A new version of the driver is going to be relaseed soon to address this
					// if i == 0 {
					// we can't append null values for the first vector value
					// set a placeholdrer value we will later update to null
					row = append(row, placeholder(tf))
					key := fmt.Sprintf("%s|%s", f.RefID, tf.Name)
					nullFields[key] = tf
				}
			}

			table := tables[f.RefID]
			if table == nil {
				table = Table{}
			}
			table = append(table, row)
			tables[f.RefID] = table
		}
	}
	return tables, nullFields
}

// fields gets a map of unique fields for dataframes with the same RefID
func fields(frames data.Frames) TableFields {
	var lookup = TableFields{}
	for _, f := range frames {
		exists := lookup[f.RefID]
		if exists == nil {
			lookup[f.RefID] = f.Fields
		} else {
			for _, fld := range f.Fields {
				var found *data.Field
				for _, fld1 := range exists {
					if fld.Name != fld1.Name {
						found = fld
						break
					}
				}
				if found != nil {
					exists := append(exists, found)
					lookup[f.RefID] = exists
				}
			}
		}
	}
	return lookup
}

// TODO: maybe only if they don't have an order clause
// func sortTablesByTime(tables Tables) {
// 	for _, t := range tables {

// 		sortIndex := -1

// 		// find the time field
// 		if len(t) >= 0 {
// 			row1 := t[0]
// 			for i, c := range row1 {
// 				switch c.(type) {
// 				case time.Time:
// 					sortIndex = i
// 				}
// 				if sortIndex > -1 {
// 					break
// 				}
// 			}
// 		}

// 		if sortIndex > -1 {
// 			sort.SliceStable(t, func(i, j int) bool {
// 				row := t[i]
// 				row2 := t[j]
// 				time1 := row[sortIndex].(time.Time)
// 				time2 := row2[sortIndex].(time.Time)
// 				return time1.Before(time2)
// 			})
// 		}
// 	}
// }
