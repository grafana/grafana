package queryschema

import (
	"fmt"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

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
	removeSchemaRefs(s)
	s.SchemaProps.Schema = "" // remove the "$schema" link
	s.Description = "Schema for a set of queries sent to the query method"
	oas.Components.Schemas[QueryRequestSchemaKey] = s

	// // Query Payload (is this useful?)rica

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

func removeSchemaRefs(s *spec.Schema) {
	if s == nil {
		return
	}
	if s.Schema != "" {
		fmt.Printf("remove: %s\n", s.Schema)
		s.Schema = ""
	}
	// Examples is invalid -- only use the first example
	examples, ok := s.ExtraProps["examples"]
	if ok {
		s.Example = examples
		delete(s.ExtraProps, "examples")
	}

	if s.Description == "From is the start time of the query." {
		fmt.Printf("FROM: %+v\n", s)
	}

	removeSchemaRefs(s.Not)
	for idx := range s.AllOf {
		removeSchemaRefs(&s.AllOf[idx])
	}
	for idx := range s.AnyOf {
		removeSchemaRefs(&s.AnyOf[idx])
	}
	for k := range s.Properties {
		v := s.Properties[k]
		removeSchemaRefs(&v)
		s.Properties[k] = v
	}
	if s.Items != nil {
		removeSchemaRefs(s.Items.Schema)
		for idx := range s.Items.Schemas {
			removeSchemaRefs(&s.Items.Schemas[idx])
		}
	}
}
