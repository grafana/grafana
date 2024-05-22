package queryschema

import (
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
)

const QueryRequestSchemaKey = "QueryRequestSchema"

// const QueryPayloadSchemaKey = "QueryPayloadSchema"
// const QuerySaveModelSchemaKey = "QuerySaveModelSchema"

func AddQueriesToOpenAPI(queryTypes *query.QueryTypeDefinitionList, oas *spec3.OpenAPI, pluginJSON *plugins.JSONData) error {
	if queryTypes == nil {
		return nil
	}
	opts := schemabuilder.QuerySchemaOptions{
		PluginID:   []string{""},
		QueryTypes: []data.QueryTypeDefinition{},
	}
	if pluginJSON != nil {
		opts.PluginID = []string{pluginJSON.ID}
		if pluginJSON.AliasIDs != nil {
			opts.PluginID = append(opts.PluginID, pluginJSON.AliasIDs...)
		}
	}
	// The SDK type and api type are not the same so we just recreate it here
	for _, qt := range queryTypes.Items {
		opts.QueryTypes = append(opts.QueryTypes, data.QueryTypeDefinition{
			ObjectMeta: data.ObjectMeta{
				Name: qt.Name,
			},
			Spec: qt.Spec,
		})
	}

	// Query Request
	opts.Mode = schemabuilder.SchemaTypeQueryRequest
	s, err := schemabuilder.GetQuerySchema(opts)
	if err != nil {
		return err
	}
	s.Extensions = nil // remove the $schema
	s.Description = "Schema for a set of queries sent to the query method"
	oas.Components.Schemas[QueryRequestSchemaKey] = s

	// // Query Payload (is this useful?)
	// opts.Mode = schemabuilder.SchemaTypeQueryPayload
	// s, err = schemabuilder.GetQuerySchema(opts)
	// if err != nil {
	// 	return err
	// }
	// delete(s.ExtraProps, "$schema")
	// s.Description = "Schema for a single query object including all runtime properties"
	// oas.Components.Schemas[QueryPayloadSchemaKey] = s

	// // Query Save Model
	// opts.Mode = schemabuilder.SchemaTypeSaveModel
	// s, err = schemabuilder.GetQuerySchema(opts)
	// if err != nil {
	// 	return err
	// }
	// s.Extensions = nil // remove the $schema
	// s.Description = "Valid save model for a single query target"
	// oas.Components.Schemas[QuerySaveModelSchemaKey] = s
	return nil
}
