package export

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type fieldInfo struct {
	Name string
	Conv data.FieldConverter
}

type frameOpts struct {
	schema []fieldInfo
	skip   []string
}

func prettyJSON(v interface{}) []byte {
	b, _ := json.MarshalIndent(v, "", "  ")
	return b
}

func queryResultToDataFrame(rows []map[string]interface{}, opts frameOpts) (*data.Frame, error) {
	count := len(rows)
	if count < 1 {
		return nil, nil // empty frame
	}

	schema := opts.schema
	if len(schema) < 1 {
		skip := make(map[string]bool, len(opts.skip))
		for _, k := range opts.skip {
			skip[k] = true
		}

		for k, v := range rows[0] {
			if skip[k] {
				continue
			}
			field := fieldInfo{
				Name: k,
				Conv: data.FieldConverter{
					OutputFieldType: data.FieldTypeFor(v),
				},
			}
			if field.Conv.OutputFieldType == data.FieldTypeUnknown {
				fmt.Printf("UNKNOWN type: %s / %v\n", k, v)
				continue
			}

			// Don't write passwords to disk for now!!!!
			if k == "password" || k == "salt" {
				field.Conv.Converter = func(v interface{}) (interface{}, error) {
					return fmt.Sprintf("<%s>", k), nil
				}
			}

			schema = append(schema, field)
		}
	}

	fields := make([]*data.Field, len(schema))
	for i, s := range schema {
		fields[i] = data.NewFieldFromFieldType(s.Conv.OutputFieldType, count)
		fields[i].Name = s.Name
	}

	var err error
	for i, row := range rows {
		for j, s := range schema {
			v, ok := row[s.Name]
			if ok && v != nil {
				if s.Conv.Converter != nil {
					v, err = s.Conv.Converter(v)
					if err != nil {
						return nil, fmt.Errorf("converting field: %s // %s", s.Name, err.Error())
					}
				}
				fields[j].Set(i, v)
			}
		}
	}

	// Fields are in random order
	if len(opts.schema) < 1 {
		last := []*data.Field{}
		frame := data.NewFrame("")
		lookup := make(map[string]*data.Field, len(fields))
		for _, f := range fields {
			if f.Name == "id" {
				frame.Fields = append(frame.Fields, f) // first
				continue
			}
			lookup[f.Name] = f
		}

		// First items
		for _, name := range []string{"name", "login", "email", "role", "description", "uid"} {
			f, ok := lookup[name]
			if ok {
				frame.Fields = append(frame.Fields, f) // first
				delete(lookup, name)
			}
		}

		// IDs
		for k, f := range lookup {
			if strings.HasSuffix(k, "_id") {
				frame.Fields = append(frame.Fields, f) // first
				delete(lookup, k)
			} else if strings.HasPrefix(k, "is_") {
				last = append(last, f) // first
				delete(lookup, k)
			}
		}

		// Last items
		for _, name := range []string{"created", "updated"} {
			f, ok := lookup[name]
			if ok {
				last = append(last, f) // first
				delete(lookup, name)
			}
		}

		// Rest
		for _, f := range lookup {
			frame.Fields = append(frame.Fields, f)
		}

		frame.Fields = append(frame.Fields, last...)
		return frame, nil
	}
	return data.NewFrame("", fields...), nil
}
