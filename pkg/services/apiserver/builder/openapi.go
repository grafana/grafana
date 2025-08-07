package builder

import (
	"bytes"
	"encoding/json"
	"maps"
	"strings"
	"sync"

	apiequality "k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/apimachinery/pkg/runtime/schema"
	openapi "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/logging"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	secret "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var (
	equalityInit sync.Once
)

// This should eventually live in grafana-app-sdk
func GetOpenAPIDefinitions(builders []APIGroupBuilder, additionalGetters ...openapi.GetOpenAPIDefinitions) openapi.GetOpenAPIDefinitions {
	equalityInit.Do(func() {
		// DataQuery has private variables, so it needs an explicit equality helper
		err := apiequality.Semantic.AddFunc(
			func(a, b data.DataQuery) bool {
				aa, _ := json.Marshal(a)
				bb, _ := json.Marshal(b)
				return bytes.Equal(aa, bb)
			},
		)
		logging.DefaultLogger.Error("error initializing DataQuery apiequality", "err", err)
	})

	return func(ref openapi.ReferenceCallback) map[string]openapi.OpenAPIDefinition {
		defs := common.GetOpenAPIDefinitions(ref) // common grafana apis
		maps.Copy(defs, data.GetOpenAPIDefinitions(ref))
		maps.Copy(defs, secret.GetOpenAPIDefinitions(ref)) // Expose secret reference to all resources

		for _, getter := range additionalGetters {
			if getter != nil {
				maps.Copy(defs, getter(ref))
			}
		}

		// TODO: add timerange to upstream SDK setup
		maps.Copy(defs, map[string]openapi.OpenAPIDefinition{
			"github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1.TimeRange": {
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

func addBuilderRoutes(
	targetGroupVersion schema.GroupVersion,
	openAPISpec *spec3.OpenAPI,
	apiGroupBuilders []APIGroupBuilder,
) (*spec3.OpenAPI, error) {
	for _, apiGroupBuilder := range apiGroupBuilders {
		// Optionally include raw http handlers for all builders
		for _, gv := range GetGroupVersions(apiGroupBuilder) {
			if gv != targetGroupVersion {
				continue // Only add routes for the target group version
			}
			provider, ok := apiGroupBuilder.(APIGroupRouteProvider)
			if ok && provider != nil {
				routes := provider.GetAPIRoutes(gv)
				if routes != nil {
					for _, route := range routes.Root {
						openAPISpec.Paths.Paths["/apis/"+gv.String()+"/"+route.Path] = &spec3.Path{
							PathProps: *route.Spec,
						}
					}

					for _, route := range routes.Namespace {
						openAPISpec.Paths.Paths["/apis/"+gv.String()+"/namespaces/{namespace}/"+route.Path] = &spec3.Path{
							PathProps: *route.Spec,
						}
					}
				}
			}
			// Support direct manipulation of API results
			processor, ok := apiGroupBuilder.(OpenAPIPostProcessor)
			if ok {
				return processor.PostProcessOpenAPI(openAPISpec)
			}
		}
	}
	return openAPISpec, nil
}

// Modify the OpenAPI spec to include the additional routes.
// nolint:gocyclo
func getOpenAPIPostProcessor(version string, builders []APIGroupBuilder, gvs []schema.GroupVersion) func(*spec3.OpenAPI) (*spec3.OpenAPI, error) {
	return func(s *spec3.OpenAPI) (*spec3.OpenAPI, error) {
		if s.Paths == nil {
			return s, nil
		}

		for _, gv := range gvs {
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

				for k, v := range copy.Paths.Paths {
					if k == prefix {
						continue // API discovery
					}

					// Remove the deprecated watch URL -- can use list with ?watch=true
					if strings.HasPrefix(k, prefix+"watch/") {
						delete(copy.Paths.Paths, k)
						continue
					}

					// Remove the "for all namespaces" global routes from OpenAPI (v3)
					if !strings.HasPrefix(k, prefix+"namespaces/") {
						delete(copy.Paths.Paths, k)
						continue
					}

					// Delete has all parameters in the query string already
					if v.Delete != nil {
						action, ok := v.Delete.Extensions.GetString("x-kubernetes-action")
						if ok && (action == "deletecollection" || action == "delete") {
							v.Delete.RequestBody = nil // duplicates all the parameters
						}
					}

					// Replace any */* media types with json+yaml (protobuf?)
					ops := []*spec3.Operation{v.Delete, v.Put, v.Post}
					for _, op := range ops {
						if op == nil || op.RequestBody == nil || len(op.RequestBody.Content) != 1 {
							continue
						}
						content, ok := op.RequestBody.Content["*/*"]
						if ok {
							op.RequestBody.Content = map[string]*spec3.MediaType{
								"application/json":                    content,
								"application/yaml":                    content,
								"application/vnd.kubernetes.protobuf": content,
							}
						}
					}
				}

				sub := copy.Paths.Paths[prefix]
				if sub != nil && sub.Get != nil {
					sub.Get.Tags = []string{"API Discovery"}
					sub.Get.Description = "Describe the available kubernetes resources"
				}

				// Remove the growing list of kinds
				for k, v := range copy.Components.Schemas {
					if v.Extensions == nil {
						continue
					}
					if strings.HasPrefix(k, "io.k8s.apimachinery.pkg.apis.meta.v1") {
						delete(v.Extensions, "x-kubernetes-group-version-kind") // a growing list of everything
						continue
					}

					// Remove the internal annotations
					val, ok := v.Extensions["x-kubernetes-group-version-kind"]
					if ok {
						gvks, ok := val.([]any)
						if ok {
							keep := make([]map[string]any, 0, len(gvks))
							for _, val := range gvks {
								gvk, ok := val.(map[string]any)
								if ok && gvk["version"] == "__internal" {
									continue
								}
								keep = append(keep, gvk)
							}
							v.Extensions["x-kubernetes-group-version-kind"] = keep
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
				return addBuilderRoutes(gv, &copy, builders)
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
