package builder

import (
	"bytes"
	"encoding/json"
	"maps"
	"net/http"
	"strings"
	"sync"

	apiequality "k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/apimachinery/pkg/runtime/schema"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	"k8s.io/klog/v2"
	openapi "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	spec "k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/logging"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
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
		if err != nil {
			logging.DefaultLogger.Error("error initializing DataQuery apiequality", "err", err)
		}
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
	apiResourceConfig *serverstorage.ResourceConfig,
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

	// filter out api groups that are disabled in APIEnablementOptions
	for path := range openAPISpec.Paths.Paths {
		if strings.HasPrefix(path, "/apis/"+targetGroupVersion.String()+"/") {
			gv := targetGroupVersion.WithResource("")
			if apiResourceConfig != nil && !apiResourceConfig.ResourceEnabled(gv) {
				klog.InfoS("removing openapi routes for disabled resource", "gv", gv.String())
				delete(openAPISpec.Paths.Paths, path)
			}
		}
	}

	return openAPISpec, nil
}

// Checks if the path is a "for all namespaces" endpoint
// If the path is a cluster-scoped resource, return false
func isAllRoute(prefix, path string, paths map[string]*spec3.Path) bool {
	if strings.HasPrefix(path, prefix+"namespaces/") {
		return false
	}

	// Extract the resource path after the group/version prefix
	resourcePath := strings.TrimPrefix(path, prefix)
	// Build the potential namespaced path to check
	namespacedPath := prefix + "namespaces/{namespace}/" + resourcePath
	// Check if the namespaced path exists
	_, hasNamespacedPath := paths[namespacedPath]
	// If the namespaced path exists, this is a "for all namespaces" endpoint - remove it
	// Otherwise, it's a cluster-scoped resource - keep it
	return hasNamespacedPath
}

// Modify the OpenAPI spec to include the additional routes.
// nolint:gocyclo
func getOpenAPIPostProcessor(version string, builders []APIGroupBuilder, gvs []schema.GroupVersion, apiResourceConfig *serverstorage.ResourceConfig) func(*spec3.OpenAPI) (*spec3.OpenAPI, error) {
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
					// Except for cluster-scoped resources
					if isAllRoute(prefix, k, copy.Paths.Paths) {
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

					// Replace any */* media types with json+yaml
					ops := []*spec3.Operation{v.Delete, v.Put, v.Post}
					for _, op := range ops {
						if op == nil || op.RequestBody == nil || len(op.RequestBody.Content) != 1 {
							continue
						}
						content, ok := op.RequestBody.Content["*/*"]
						if ok {
							op.RequestBody.Content = map[string]*spec3.MediaType{
								"application/json": content,
								"application/yaml": content,
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
								if ok && gvk["group"] == gv.Group && gvk["version"] != "__internal" {
									keep = append(keep, gvk) // only expose real versions in the same group
								}
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
								action, ok := op.Extensions.GetString("x-kubernetes-action")
								if ok && action == "connect" {
									op.Tags = parent.Get.Tags
								}
							}
						}
					}
				}
				result, err := addBuilderRoutes(gv, &copy, builders, apiResourceConfig)
				if err != nil {
					return nil, err
				}
				// Remove protobuf from all paths (including routes added by addBuilderRoutes)
				for _, path := range result.Paths.Paths {
					allOps := GetPathOperations(path)
					for _, op := range allOps {
						if op == nil {
							continue
						}
						// Remove protobuf from request body content types
						if op.RequestBody != nil && op.RequestBody.Content != nil {
							delete(op.RequestBody.Content, "application/vnd.kubernetes.protobuf")
						}
						// Remove protobuf from response content types
						if op.Responses != nil {
							if op.Responses.StatusCodeResponses != nil {
								for _, response := range op.Responses.StatusCodeResponses {
									if response.Content != nil {
										delete(response.Content, "application/vnd.kubernetes.protobuf")
										delete(response.Content, "application/vnd.kubernetes.protobuf;stream=watch")
									}
								}
							}
							// Handle default response
							if op.Responses.Default != nil && op.Responses.Default.Content != nil {
								delete(op.Responses.Default.Content, "application/vnd.kubernetes.protobuf")
								delete(op.Responses.Default.Content, "application/vnd.kubernetes.protobuf;stream=watch")
							}
						}
					}
				}
				return result, nil
			}
		}
		return s, nil
	}
}

// GetPathOperations returns the set of non-nil operations defined on a path
func GetPathOperations(path *spec3.Path) map[string]*spec3.Operation {
	ops := make(map[string]*spec3.Operation)
	if path.Get != nil {
		ops[http.MethodGet] = path.Get
	}
	if path.Head != nil {
		ops[http.MethodHead] = path.Head
	}
	if path.Delete != nil {
		ops[http.MethodDelete] = path.Delete
	}
	if path.Post != nil {
		ops[http.MethodPost] = path.Post
	}
	if path.Put != nil {
		ops[http.MethodPut] = path.Put
	}
	if path.Patch != nil {
		ops[http.MethodPatch] = path.Patch
	}
	if path.Trace != nil {
		ops[http.MethodTrace] = path.Trace
	}
	if path.Options != nil {
		ops[http.MethodOptions] = path.Options
	}
	return ops
}
