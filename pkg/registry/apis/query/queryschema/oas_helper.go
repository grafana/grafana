package queryschema

import (
	"fmt"
	"strings"

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

type OASQueryOptions struct {
	Swagger    *spec3.OpenAPI
	PluginJSON *plugins.JSONData
	QueryTypes *query.QueryTypeDefinitionList

	Root             string
	QueryPath        string // eg "namespaces/{namespace}/query/{name}"
	QueryDescription string
	QueryExamples    map[string]*spec3.Example
}

func AddQueriesToOpenAPI(options OASQueryOptions) error {
	oas := options.Swagger
	root := options.Root
	examples := options.QueryExamples
	resourceName := query.QueryTypeDefinitionResourceInfo.GroupResource().Resource

	builder := schemabuilder.QuerySchemaOptions{
		PluginID:   []string{""},
		QueryTypes: []data.QueryTypeDefinition{},
	}
	if options.PluginJSON != nil {
		builder.PluginID = []string{options.PluginJSON.ID}
		if options.PluginJSON.AliasIDs != nil {
			builder.PluginID = append(builder.PluginID, options.PluginJSON.AliasIDs...)
		}
	}
	if options.QueryTypes != nil {
		// The SDK type and api type are not the same so we just recreate it here
		for _, qt := range options.QueryTypes.Items {
			builder.QueryTypes = append(builder.QueryTypes, data.QueryTypeDefinition{
				ObjectMeta: data.ObjectMeta{
					Name: qt.Name,
				},
				Spec: qt.Spec,
			})
		}

		if examples == nil {
			examples = getExamples(options.QueryTypes)
		}
	}

	// Rewrite the query path
	query := oas.Paths.Paths[root+options.QueryPath]
	if query != nil && query.Post != nil {
		query.Post.Tags = []string{"DataSource"}
		query.Post.Description = options.QueryDescription
		query.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema:   spec.RefSchema("#/components/schemas/" + QueryRequestSchemaKey),
							Examples: examples,
						},
					},
				},
			},
		}

		// Remove the {name} hack from from the query
		if strings.HasSuffix(options.QueryPath, "/{name}") {
			delete(oas.Paths.Paths, root+options.QueryPath)
			oas.Paths.Paths[root+strings.TrimSuffix(options.QueryPath, "/{name}")] = query
		}
	}

	// Update the validate endpoint
	validate := oas.Paths.Paths[root+resourceName+"/{name}/validate"]
	if validate != nil && validate.Post != nil {
		validate.Post.Description = "Verify if a query payload matches the expected value and return a clean version"
		validate.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "name",
					In:          "path",
					Description: "The query type name, or {any}",
					Example:     "{any}",
					Required:    true,
					Schema:      spec.StringProperty().UniqueValues(),
				},
			},
		}

		// Accept the same payload as the query type
		validate.Post.RequestBody = query.Post.RequestBody
	}

	// Query Request
	builder.Mode = schemabuilder.SchemaTypeQueryRequest
	s, err := schemabuilder.GetQuerySchema(builder)
	if err != nil {
		return err
	}

	// The schema requires some munging to pass validation
	// This should likely be fixed in the upstream "GetQuerySchema" function
	removeSchemaRefs(s)
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

func getExamples(queryTypes *query.QueryTypeDefinitionList) map[string]*spec3.Example {
	if queryTypes == nil {
		return nil
	}

	tr := data.TimeRange{From: "now-1h", To: "now"}
	examples := map[string]*spec3.Example{}
	for _, queryType := range queryTypes.Items {
		for idx, example := range queryType.Spec.Examples {
			q := data.NewDataQuery(example.SaveModel.Object)
			q.RefID = "A"
			for _, dis := range queryType.Spec.Discriminators {
				_ = q.Set(dis.Field, dis.Value)
			}
			if q.MaxDataPoints < 1 {
				q.MaxDataPoints = 1000
			}
			if q.IntervalMS < 1 {
				q.IntervalMS = 5000 // 5s
			}
			examples[fmt.Sprintf("%s-%d", example.Name, idx)] = &spec3.Example{
				ExampleProps: spec3.ExampleProps{
					Summary:     example.Name,
					Description: example.Description,
					Value: data.QueryDataRequest{
						TimeRange: tr,
						Queries:   []data.DataQuery{q},
					},
				},
			}
		}
	}
	return examples
}

func removeSchemaRefs(s *spec.Schema) {
	if s == nil {
		return
	}
	if s.Schema != "" {
		s.Schema = ""
	}
	// Examples is invalid -- only use the first example
	examples, ok := s.ExtraProps["examples"]
	if ok && examples != nil {
		//fmt.Printf("TODO, use reflection to get first element from: %+v\n", examples)
		//s.Example = examples[0]
		delete(s.ExtraProps, "examples")
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
	if s.AdditionalProperties != nil {
		removeSchemaRefs(s.AdditionalProperties.Schema)
	}
	if s.AdditionalItems != nil {
		removeSchemaRefs(s.AdditionalItems.Schema)
	}
}
