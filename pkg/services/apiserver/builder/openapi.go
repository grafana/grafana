package builder

import (
	"maps"
	"strings"

	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// This should eventually live in grafana-app-sdk
func GetOpenAPIDefinitions(builders []APIGroupBuilder) common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		defs := v0alpha1.GetOpenAPIDefinitions(ref) // common grafana apis
		maps.Copy(defs, data.GetOpenAPIDefinitions(ref))
		// TODO: remove when https://github.com/grafana/grafana-plugin-sdk-go/pull/1062 is merged
		maps.Copy(defs, map[string]common.OpenAPIDefinition{
			"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1.DataSourceRef": {
				Schema: spec.Schema{
					SchemaProps: spec.SchemaProps{
						Type:                 []string{"object"},
						AdditionalProperties: &spec.SchemaOrBool{Allows: true},
					},
				},
			},
		})
		for _, b := range builders {
			g := b.GetOpenAPIDefinitions()
			if g != nil {
				out := g(ref)
				maps.Copy(defs, out)
			}
		}
		return defs
	}
}

// Modify the OpenAPI spec to include the additional routes.
// Currently this requires: https://github.com/kubernetes/kube-openapi/pull/420
// In future k8s release, the hook will use Config3 rather than the same hook for both v2 and v3
func getOpenAPIPostProcessor(version string, builders []APIGroupBuilder) func(*spec3.OpenAPI) (*spec3.OpenAPI, error) {
	return func(s *spec3.OpenAPI) (*spec3.OpenAPI, error) {
		if s.Paths == nil {
			return s, nil
		}

		for _, b := range builders {
			for _, gv := range GetGroupVersions(b) {
				prefix := "/apis/" + gv.String() + "/"
				if s.Paths.Paths[prefix] != nil {
					copy := spec3.OpenAPI{
						Version: s.Version,
						Info: &spec.Info{
							InfoProps: spec.InfoProps{
								Title:   gv.String(),
								Version: version,
							},
						},
						Components:   s.Components,
						ExternalDocs: s.ExternalDocs,
						Servers:      s.Servers,
						Paths:        s.Paths,
					}

					for k := range copy.Paths.Paths {
						// Remove the deprecated watch URL -- can use list with ?watch=true
						if strings.HasPrefix(k, prefix+"watch/") {
							delete(copy.Paths.Paths, k)
							continue
						}
					}

					sub := copy.Paths.Paths[prefix]
					if sub != nil && sub.Get != nil {
						sub.Get.Tags = []string{"API Discovery"}
						sub.Get.Description = "Describe the available kubernetes resources"
					}

					// Remove the growing list of kinds
					for k, v := range copy.Components.Schemas {
						if strings.HasPrefix(k, "io.k8s.apimachinery.pkg.apis.meta.v1") && v.Extensions != nil {
							delete(v.Extensions, "x-kubernetes-group-version-kind") // a growing list of everything
						}
					}

					// Optionally include raw http handlers
					provider, ok := b.(APIGroupRouteProvider)
					if ok && provider != nil {
						routes := provider.GetAPIRoutes()
						if routes != nil {
							for _, route := range routes.Root {
								copy.Paths.Paths[prefix+route.Path] = &spec3.Path{
									PathProps: *route.Spec,
								}
							}

							for _, route := range routes.Namespace {
								copy.Paths.Paths[prefix+"namespaces/{namespace}/"+route.Path] = &spec3.Path{
									PathProps: *route.Spec,
								}
							}
						}
					}

					// Make the sub-resources (connect) share the same tags as the main resource
					for path, spec := range copy.Paths.Paths {
						idx := strings.LastIndex(path, "{name}/")
						if idx > 0 {
							parent := copy.Paths.Paths[path[:idx+6]]
							if parent != nil && parent.Get != nil {
								for _, op := range GetPathOperations(spec) {
									if op != nil && op.Extensions != nil {
										action, ok := op.Extensions.GetString("x-kubernetes-action")
										if ok && action == "connect" {
											op.Tags = parent.Get.Tags
										}
									}
								}
							}
						}
					}

					// Support direct manipulation of API results
					processor, ok := b.(OpenAPIPostProcessor)
					if ok {
						return processor.PostProcessOpenAPI(&copy)
					}
					return &copy, nil
				}
			}
		}

		return s, nil
	}
}

func GetPathOperations(path *spec3.Path) []*spec3.Operation {
	return []*spec3.Operation{
		path.Get,
		path.Head,
		path.Delete,
		path.Patch,
		path.Post,
		path.Put,
		path.Trace,
		path.Options,
	}
}
