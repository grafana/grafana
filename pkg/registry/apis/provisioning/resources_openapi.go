package provisioning

import (
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

func (b *APIBuilder) postProcessResourcesOpenAPI(oas *spec3.OpenAPI, repoprefix, compBase string) {
	if sub := oas.Paths.Paths[repoprefix+"/resources"]; sub != nil {
		sub.Post = nil
	}

	// Kubernetes emits a wildcard for connectors, but resources supports only the literal resolve path.
	sub := oas.Paths.Paths[repoprefix+"/resources/{path}"]
	delete(oas.Paths.Paths, repoprefix+"/resources/{path}")
	if sub == nil || sub.Post == nil {
		return
	}
	oas.Paths.Paths[repoprefix+"/resources/resolve"] = &spec3.Path{PathProps: *resourceResolveOpenAPIPath(compBase)}

	// The general postprocessor adds missing definitions with an empty reference callback.
	// These request and response schemas need their nested references preserved.
	defs := b.GetOpenAPIDefinitions()(func(name string) spec.Ref {
		return spec.MustCreateRef("#/components/schemas/" + name)
	})
	for _, name := range []string{"ResourceResolveRequest", "ResourceResolveResponse", "ResourceResolveResult"} {
		schema := defs[compBase+name].Schema
		oas.Components.Schemas[compBase+name] = &schema
	}
}

func resourceResolveOpenAPIPath(prefix string) *spec3.PathProps {
	component := func(name string) *spec.Schema {
		return &spec.Schema{SchemaProps: spec.SchemaProps{Ref: spec.MustCreateRef("#/components/schemas/" + prefix + name)}}
	}
	return &spec3.PathProps{
		Post: &spec3.Operation{OperationProps: spec3.OperationProps{
			OperationId: "resolveRepositoryResources",
			Tags:        []string{"Provisioning", "Repository"},
			Description: "Resolve exact repository paths to synced resources the caller can read. Duplicate paths are returned once in first-occurrence order. Unavailable paths have no resource.",
			Parameters: []*spec3.Parameter{
				{ParameterProps: spec3.ParameterProps{Name: "namespace", In: "path", Required: true, Description: "workspace", Schema: spec.StringProperty()}},
				{ParameterProps: spec3.ParameterProps{Name: "name", In: "path", Required: true, Description: "repository name", Schema: spec.StringProperty()}},
			},
			RequestBody: &spec3.RequestBody{RequestBodyProps: spec3.RequestBodyProps{
				Required: true,
				Content:  map[string]*spec3.MediaType{"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: component("ResourceResolveRequest")}}},
			}},
			Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
				StatusCodeResponses: map[int]*spec3.Response{200: {ResponseProps: spec3.ResponseProps{
					Description: "Resource resolution results",
					Content:     map[string]*spec3.MediaType{"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: component("ResourceResolveResponse")}}},
				}}},
			}},
		}},
	}
}
