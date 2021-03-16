package elasticsearch

import (
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type fieldsQuery struct {
	client    es.Client
	tsdbQuery plugins.DataQuery
}

var newFieldsQuery = func(client es.Client, dataQuery plugins.DataQuery) *fieldsQuery {
	return &fieldsQuery{
		client:    client,
		tsdbQuery: dataQuery,
	}
}

func (e *fieldsQuery) execute() (plugins.DataResponse, error) {
	query := e.tsdbQuery.Queries[0]

	indexMapping, err := e.client.GetIndexMapping()
	if err != nil {
		return plugins.DataResponse{}, err
	}

	var fieldTypeFilter string
	if typeProp, ok := query.Model.CheckGet("fieldTypeFilter"); ok {
		fieldTypeFilter = typeProp.MustString()
	}

	return transform(indexMapping, fieldTypeFilter, query.RefID)
}

type fieldsMap map[string]string

func extractFields(fieldMap map[string]interface{}, path []string) fieldsMap {
	// TODO: Old js implementation had this:
	// if (configuredEsVersion < 70) {
	// 		for (const typeName in mappings) {
	// 	  		const properties = mappings[typeName].properties;
	// 	  		getFieldsRecursively(properties);
	// 		}
	// } else {
	// 		const properties = mappings.properties;
	// 		getFieldsRecursively(properties);
	// }
	properties := fieldMap["properties"].(map[string]interface{})
	fields := fieldsMap{}

	for key, v := range properties {
		// We skip adding the field if it's a known metadata field.
		if isMetadataField(key) {
			continue
		}

		vv := v.(map[string]interface{})

		if vv["type"] != nil {
			fields[strings.Join(append(path, key), ".")] = vv["type"].(string)
		}

		if vv["properties"] != nil {
			f := extractFields(vv, append(path, key))

			for k, v := range f {
				fields[k] = v
			}
		}
	}

	return fields
}

// Here we transform a raw ES `/_mappings` response to a table structure to return to the frontend.
// The table has the following structure:
//
// |-----------|-----------|
// | name      | type      |
// |-----------|-----------|
// | fieldName | fieldType |
// |-----------|-----------|
func transform(indexMapping *es.IndexMappingResponse, fieldTypeFilter, refID string) (plugins.DataResponse, error) {
	if indexMapping.Error != nil {
		return plugins.DataResponse{
			Results: map[string]plugins.DataQueryResult{
				// TODO: This
				// refID: getErrorFromElasticResponse(indexMapping.Error),
			},
		}, nil
	}

	// We create the table structure for the response
	table := plugins.DataTable{
		Columns: make([]plugins.DataTableColumn, 0),
		Rows:    make([]plugins.DataRowValues, 0),
	}
	table.Columns = append(table.Columns, plugins.DataTableColumn{Text: "name"})
	table.Columns = append(table.Columns, plugins.DataTableColumn{Text: "type"})

	// fieds contains data in the form of { [filedName]: type }
	extractedFields := fieldsMap{}
	for indexName := range indexMapping.Mappings {
		index := indexMapping.Mappings[indexName].(map[string]interface{})
		mappings := index["mappings"].(map[string]interface{})

		extractedFields = extractFields(mappings, nil)
	}

	// from extractedFields we get only those fields that match the provided type alias
	filteredFields := fieldsMap{}
	for fieldName := range extractedFields {
		if fieldTypeMatchesAlias(extractedFields[fieldName], fieldTypeFilter) {
			filteredFields[fieldName] = extractedFields[fieldName]
		}
	}

	// We alphabetically sort the field names in a new slice
	fieldNames := []string{}
	for fieldName := range filteredFields {
		fieldNames = append(fieldNames, fieldName)
	}
	sort.Strings(fieldNames)

	// We iterate over the sorted slice, adding a row ro the response table for each field
	for _, fieldName := range fieldNames {
		table.Rows = append(table.Rows, plugins.DataRowValues{fieldName, filteredFields[fieldName]})
	}

	result := plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{
			refID: {
				RefID:  refID,
				Tables: []plugins.DataTable{table},
			},
		},
	}

	return result, nil
}

// Given a field name `fieldName` returns `true` if `fieldName` is a known metadata field according to https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-fields.html#_identity_metadata_fields, `false` otherwise
func isMetadataField(fieldName string) bool {
	// The following are metadata fields as defined in https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-fields.html#_identity_metadata_fields.
	// custom fields can start with underscores, therefore is not safe to exclude anything that starts with one.
	elasticsearchMetaFields := []string{
		"_index",
		"_type",
		"_id",
		"_source",
		"_size",
		"_field_names",
		"_ignored",
		"_routing",
		"_meta",
	}

	for _, metaField := range elasticsearchMetaFields {
		if metaField == fieldName {
			return true
		}
	}

	return false
}

// Given a `fieldType` and a `typeAlias`, returns true if the field type matches the given alias, false otherwise
// eg. a "string" type alias will return `true` for fields of type "text" and "string"
func fieldTypeMatchesAlias(fieldType string, typeAlias string) bool {
	typeMap := map[string]string{
		"float":        "number",
		"double":       "number",
		"integer":      "number",
		"long":         "number",
		"scaled_float": "number",
		"histogram":    "number",
		"date_nanos":   "date",
		"text":         "string",
		"nested":       "nested",
	}

	return typeMap[fieldType] == typeAlias || fieldType == typeAlias
}
