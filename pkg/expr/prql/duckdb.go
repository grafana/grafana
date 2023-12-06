package prql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	duckdb "github.com/marcboeker/go-duckdb"
)

type DuckDB struct {
	DB   *sql.DB
	Name string
}

func (d *DuckDB) Query(q string) (data.Frames, error) {
	db, err := sql.Open("duckdb", d.Name)
	if err != nil {
		return nil, err
	}
	d.DB = db
	defer func(db *sql.DB) {
		err = db.Close()
		fmt.Println("failed to close db")
	}(db)

	results, err := d.DB.Query(q)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	// TODO - add any needed converters for duckdb
	frame, err := sqlutil.FrameFromRows(results, -1, sqlutil.Converter{})

	// convention for labels - join against the _meta table, it will contain all the lables
	// ------
	// from A
	// join side:left _meta ("A"==_meta.ref)
	// take 1..5

	// lables are in a field called _lables fromt the _meta table.  get the values and remove the field
	var labelsField *data.Field
	var nonLabelsFields []*data.Field
	for _, f := range frame.Fields {
		if f.Name == "_labels" {
			labelsField = f
		} else {
			nonLabelsFields = append(nonLabelsFields, f)
		}
	}

	if labelsField != nil {
		// get the labels and remove the _labels field from the frame
		if labelsField.Len() > 0 {
			slables := labelsField.At(0)
			l, ok := slables.(*string)
			if !ok {
				return nil, errors.New("wtf")
			}
			var fieldLabels FieldLables
			err := json.Unmarshal([]byte(*l), &fieldLabels)
			if err != nil {
				return nil, err
			}
			for _, f := range frame.Fields {
				labels := fieldLabels[f.Name]
				if labels == nil && strings.Contains(f.Name, "_") {
					name := strings.ReplaceAll(f.Name, "_", "-")
					labels = fieldLabels[name]
				}
				if labels != nil {
					f.Labels = labels
				}
			}
		}
		frame.Fields = nonLabelsFields
	}

	return data.Frames{frame}, err
}

func (d *DuckDB) AppendAll(ctx context.Context, frames data.Frames) error {
	db, err := sql.Open("duckdb", d.Name)
	if err != nil {
		return err
	}
	d.DB = db
	defer func(db *sql.DB) {
		err = db.Close()
		fmt.Println("failed to close db")
	}(db)
	frameLables, err := d.createTables(frames)
	if err != nil {
		return err
	}
	connector, err := duckdb.NewConnector(d.Name, nil)
	if err != nil {
		return err
	}
	conn, err := connector.Connect(context.Background())
	if err != nil {
		return err
	}
	defer conn.Close()

	for _, f := range frames {
		name := f.RefID
		if name == "" {
			name = f.Name
		}
		appender, err := duckdb.NewAppenderFromConn(conn, "", name)
		if err != nil {
			return err
		}
		for i := 0; i < f.Rows(); i++ {
			var row []driver.Value
			for _, ff := range f.Fields {
				val := ff.At(i)
				// if isPointer(val) {
				// 	val = getPointerValue(val)
				// }
				// TODO - is there a way to use generics here?
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

	}

	// labels attempt 1 - creates multiple rows which is problematic
	// labelsAppender, err := duckdb.NewAppenderFromConn(conn, "", "labels")
	// if err != nil {
	// 	return err
	// }

	// for refId, fieldLabels := range frameLables {
	// 	for f, lbls := range fieldLabels {
	// 		for name, value := range lbls {
	// 			err := labelsAppender.AppendRow(refId, f, name, value)
	// 			if err != nil {
	// 				fmt.Println(err)
	// 				return err
	// 			}
	// 		}
	// 	}
	// }

	// err = labelsAppender.Flush()
	// if err != nil {
	// 	fmt.Println(err)
	// 	return err
	// }

	// labels attempt 2 - just add all as json in one column
	metaAppender, err := duckdb.NewAppenderFromConn(conn, "", "_meta")
	if err != nil {
		return err
	}

	for refId, fieldLabels := range frameLables {

		// TOOD - scrapped this idea and just used json
		// allLabels := []string{}
		// for f, lbls := range fieldLabels {
		// 	labels := []string{}
		// 	for name, value := range lbls {
		// 		labels = append(labels, name+":"+value)
		// 	}
		// 	fieldLabels := strings.Join(labels, ",")

		// 	allLabels = append(allLabels, f+"{"+fieldLabels+"}")
		// 	// metaAppender.AppendRow(refId, f, fieldLabels)
		// 	// if err != nil {
		// 	// 	fmt.Println(err)
		// 	// 	return err
		// 	// }
		// }
		// all := strings.Join(allLabels, "|")
		// fmt.Println(all)
		// fmt.Println(fieldLabels)
		// l := fmt.Sprint(fieldLabels)
		// metaAppender.AppendRow(refId, l)
		// if err != nil {
		// 	fmt.Println(err)
		// 	return err
		// }

		jsonData, err := json.Marshal(fieldLabels)
		if err != nil {
			fmt.Println(err)
			return err
		}

		jsonString := string(jsonData)
		metaAppender.AppendRow(refId, jsonString)
		if err != nil {
			fmt.Println(err)
			return err
		}
	}

	err = metaAppender.Flush()
	if err != nil {
		fmt.Println(err)
		return err
	}
	return nil
}

// TODO - use reflection instead of checking each type?
// func isPointer(i interface{}) bool {
// 	return reflect.ValueOf(i).Type().Kind() == reflect.Pointer
// }

// func getPointerValue(i any) any {
// 	return reflect.Indirect(reflect.ValueOf(i))
// }

func (d *DuckDB) createTables(frames data.Frames) (FrameLables, error) {

	stmt := "create or replace table labels (ref VARCHAR, col VARCHAR, name VARCHAR, value VARCHAR)"
	_, err := d.DB.Query(stmt)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	// stmt = "create or replace table _meta (ref VARCHAR, _labels_col VARCHAR, _labels VARCHAR)"
	// stmt = "create or replace table _meta (ref VARCHAR, _labels_col VARCHAR, _labels VARCHAR)"
	stmt = "create or replace table _meta (ref VARCHAR, _labels VARCHAR)"
	_, err = d.DB.Query(stmt)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	frameLables := FrameLables{}

	for _, f := range frames {
		name := f.RefID
		if name == "" {
			name = f.Name
		}
		fmt.Println("creating table " + name)
		createTable := "create or replace table " + name + " ("
		sep := ""
		fieldLabels := FieldLables{}
		for _, fld := range f.Fields {
			createTable += sep
			n := strings.ReplaceAll(fld.Name, "-", "_") // TODO - surround with brackets or backticks?
			createTable += n
			if fld.Type() == data.FieldTypeBool || fld.Type() == data.FieldTypeNullableBool {
				createTable += " " + "BOOLEAN"
			}
			if fld.Type() == data.FieldTypeFloat32 || fld.Type() == data.FieldTypeFloat64 || fld.Type() == data.FieldTypeNullableFloat32 || fld.Type() == data.FieldTypeNullableFloat64 {
				createTable += " " + "DOUBLE"
			}
			if fld.Type() == data.FieldTypeInt8 || fld.Type() == data.FieldTypeInt16 || fld.Type() == data.FieldTypeInt32 || fld.Type() == data.FieldTypeNullableInt8 || fld.Type() == data.FieldTypeNullableInt16 || fld.Type() == data.FieldTypeNullableInt32 {
				createTable += " " + "INTEGER"
			}
			if fld.Type() == data.FieldTypeInt64 || fld.Type() == data.FieldTypeNullableInt64 {
				createTable += " " + "BIGINT"
			}
			if fld.Type() == data.FieldTypeUint8 || fld.Type() == data.FieldTypeUint16 || fld.Type() == data.FieldTypeUint32 || fld.Type() == data.FieldTypeNullableUint8 || fld.Type() == data.FieldTypeNullableUint16 || fld.Type() == data.FieldTypeNullableUint32 {
				createTable += " " + "UINTEGER"
			}
			if fld.Type() == data.FieldTypeUint64 || fld.Type() == data.FieldTypeNullableUint64 {
				createTable += " " + "UBIGINT"
			}
			if fld.Type() == data.FieldTypeString || fld.Type() == data.FieldTypeNullableString {
				createTable += " " + "VARCHAR"
			}
			if fld.Type() == data.FieldTypeTime || fld.Type() == data.FieldTypeNullableTime {
				createTable += " " + "TIMESTAMP"
			}
			if fld.Type() == data.FieldTypeUnknown {
				createTable += " " + "BLOB"
			}
			sep = " ,"
			fieldLabels[fld.Name] = fld.Labels
		}
		frameLables[f.RefID] = fieldLabels
		createTable += ")"
		fmt.Println(createTable)

		_, err := d.DB.Query(createTable)
		if err != nil {
			fmt.Println(err)
			return nil, err
		}
	}
	return frameLables, nil
}

type FieldLables = map[string]data.Labels

type FrameLables = map[string]FieldLables
