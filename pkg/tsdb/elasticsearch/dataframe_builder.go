package elasticsearch

import (
	"encoding/json"
	"sort"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// processDocsToDataFrameFields converts documents to data frame fields
func processDocsToDataFrameFields(docs []map[string]interface{}, propNames []string, configuredFields es.ConfiguredFields) []*data.Field {
	size := len(docs)
	isFilterable := true
	allFields := make([]*data.Field, len(propNames))
	timeString := ""
	timeStringOk := false

	for propNameIdx, propName := range propNames {
		// Special handling for time field
		if propName == configuredFields.TimeField {
			timeVector := make([]*time.Time, size)
			for i, doc := range docs {
				// Check if time field is a string
				timeString, timeStringOk = doc[configuredFields.TimeField].(string)
				// If not, it might be an array with one time string
				if !timeStringOk {
					timeList, ok := doc[configuredFields.TimeField].([]interface{})
					if !ok || len(timeList) != 1 {
						continue
					}
					// Check if the first element is a string
					timeString, timeStringOk = timeList[0].(string)
					if !timeStringOk {
						continue
					}
				}
				timeValue, err := time.Parse(time.RFC3339Nano, timeString)
				if err != nil {
					// We skip time values that cannot be parsed
					continue
				} else {
					timeVector[i] = &timeValue
				}
			}
			field := data.NewField(configuredFields.TimeField, nil, timeVector)
			field.Config = &data.FieldConfig{Filterable: &isFilterable}
			allFields[propNameIdx] = field
			continue
		}

		propNameValue := findTheFirstNonNilDocValueForPropName(docs, propName)
		switch propNameValue.(type) {
		// We are checking for default data types values (float64, int, bool, string)
		// and default to json.RawMessage if we cannot find any of them
		case float64:
			allFields[propNameIdx] = createFieldOfType[float64](docs, propName, size, isFilterable)
		case int:
			allFields[propNameIdx] = createFieldOfType[int](docs, propName, size, isFilterable)
		case string:
			allFields[propNameIdx] = createFieldOfType[string](docs, propName, size, isFilterable)
		case bool:
			allFields[propNameIdx] = createFieldOfType[bool](docs, propName, size, isFilterable)
		default:
			fieldVector := make([]*json.RawMessage, size)
			for i, doc := range docs {
				bytes, err := json.Marshal(doc[propName])
				if err != nil {
					// We skip values that cannot be marshalled
					continue
				}
				value := json.RawMessage(bytes)
				fieldVector[i] = &value
			}
			field := data.NewField(propName, nil, fieldVector)
			field.Config = &data.FieldConfig{Filterable: &isFilterable}
			allFields[propNameIdx] = field
		}
	}

	return allFields
}

// findTheFirstNonNilDocValueForPropName finds the first non-nil value for propName in docs.
// If none of the values are non-nil, it returns the value of propName in the first doc.
func findTheFirstNonNilDocValueForPropName(docs []map[string]interface{}, propName string) interface{} {
	for _, doc := range docs {
		if doc[propName] != nil {
			return doc[propName]
		}
	}
	return docs[0][propName]
}

// createFieldOfType creates a data field of the specified type
func createFieldOfType[T int | float64 | bool | string](docs []map[string]interface{}, propName string, size int, isFilterable bool) *data.Field {
	fieldVector := make([]*T, size)
	for i, doc := range docs {
		value, ok := doc[propName].(T)
		if !ok {
			continue
		}
		fieldVector[i] = &value
	}
	field := data.NewField(propName, nil, fieldVector)
	field.Config = &data.FieldConfig{Filterable: &isFilterable}
	return field
}

// createFields creates data fields from existing frames or from propKeys
func createFields(frames data.Frames, propKeys []string) []*data.Field {
	var fields []*data.Field
	have := map[string]bool{}

	// collect existing fields
	for _, frame := range frames {
		for _, f := range frame.Fields {
			fields = append(fields, f)
			have[f.Name] = true
		}
	}

	// add missing prop fields
	for _, pk := range propKeys {
		if !have[pk] {
			fields = append(fields, data.NewField(pk, nil, []*string{}))
		}
	}

	return fields
}

// createPropKeys creates a sorted list of property keys from a map
func createPropKeys(props map[string]string) []string {
	propKeys := make([]string, 0, len(props))
	for k := range props {
		propKeys = append(propKeys, k)
	}
	sort.Strings(propKeys)
	return propKeys
}

// getSortedKeys returns sorted keys from a map
func getSortedKeys(data map[string]interface{}) []string {
	keys := make([]string, 0, len(data))

	for k := range data {
		keys = append(keys, k)
	}

	sort.Strings(keys)
	return keys
}
