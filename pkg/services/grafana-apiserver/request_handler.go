package grafanaapiserver

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	restclient "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

type requestHandler struct {
	router *mux.Router
}

func GetAPIHandler(delegateHandler http.Handler, restConfig *restclient.Config, builders []APIGroupBuilder) (http.Handler, error) {
	useful := false // only true if any routes exist anywhere
	router := mux.NewRouter()
	var err error

	for _, builder := range builders {
		routes := builder.GetAPIRoutes()
		if routes == nil {
			continue
		}

		gv := builder.GetGroupVersion()
		prefix := "/apis/" + gv.String()

		// Root handlers
		var sub *mux.Router
		for _, route := range routes.Root {
			err = validPath(route.Path)
			if err != nil {
				return nil, err
			}

			if sub == nil {
				sub = router.PathPrefix(prefix).Subrouter()
				sub.MethodNotAllowedHandler = &methodNotAllowedHandler{}
			}

			useful = true
			methods, err := methodsFromSpec(route.Path, route.Spec)
			if err != nil {
				return nil, err
			}
			sub.HandleFunc(route.Path, route.Handler).
				Methods(methods...)
		}

		// Namespace handlers
		sub = nil
		prefix += "/namespaces/{namespace}"
		for _, route := range routes.Namespace {
			err = validPath(route.Path)
			if err != nil {
				return nil, err
			}
			if sub == nil {
				sub = router.PathPrefix(prefix).Subrouter()
				sub.MethodNotAllowedHandler = &methodNotAllowedHandler{}
			}

			useful = true
			methods, err := methodsFromSpec(route.Path, route.Spec)
			if err != nil {
				return nil, err
			}
			sub.HandleFunc(route.Path, route.Handler).
				Methods(methods...)
		}
	}

	if !useful {
		return delegateHandler, nil
	}

	// Per Gorilla Mux issue here: https://github.com/gorilla/mux/issues/616#issuecomment-798807509
	// default handler must come last
	router.PathPrefix("/").Handler(delegateHandler)

	return &requestHandler{
		router: router,
	}, nil
}

// The registered path must start with a slash, and (for now) not have any more
func validPath(p string) error {
	if !strings.HasPrefix(p, "/") {
		return fmt.Errorf("path must start with slash")
	}
	return nil
}

func (h *requestHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	h.router.ServeHTTP(w, req)
}

func methodsFromSpec(slug string, props *spec3.PathProps) ([]string, error) {
	if props == nil {
		return []string{"GET", "POST", "PUT", "PATCH", "DELETE"}, nil
	}

	methods := make([]string, 0)
	if props.Get != nil {
		methods = append(methods, "GET")
	}
	if props.Post != nil {
		methods = append(methods, "POST")
	}
	if props.Put != nil {
		methods = append(methods, "PUT")
	}
	if props.Patch != nil {
		methods = append(methods, "PATCH")
	}
	if props.Delete != nil {
		methods = append(methods, "DELETE")
	}

	if len(methods) == 0 {
		return nil, fmt.Errorf("invalid OpenAPI Spec for slug=%s without any methods in PathProps", slug)
	}

	return methods, nil
}

type methodNotAllowedHandler struct{}

func (h *methodNotAllowedHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	w.WriteHeader(405) // method not allowed
}

// Modify the the OpenAPI spec to include the additional routes.
// Currently this requires: https://github.com/kubernetes/kube-openapi/pull/420
// In future k8s release, the hook will use Config3 rather than the same hook for both v2 and v3
func GetOpenAPIPostProcessor(builders []APIGroupBuilder) func(*spec3.OpenAPI) (*spec3.OpenAPI, error) {
	return func(s *spec3.OpenAPI) (*spec3.OpenAPI, error) {
		if s.Paths == nil {
			return s, nil
		}
		for _, builder := range builders {
			routes := builder.GetAPIRoutes()

			gv := builder.GetGroupVersion()
			prefix := "/apis/" + gv.String()
			if s.Paths.Paths[prefix] != nil {
				copy := spec3.OpenAPI{
					Version: s.Version,
					Info: &spec.Info{
						InfoProps: spec.InfoProps{
							Title:   gv.Group,
							Version: gv.Version,
						},
					},
					Components:   s.Components,
					ExternalDocs: s.ExternalDocs,
					Servers:      s.Servers,
					Paths:        s.Paths,
				}

				if routes == nil {
					routes = &APIRoutes{}
				}

				tags := []string{}
				for _, v := range s.Paths.Paths {
					if v.Get != nil && len(v.Get.Tags) > 0 {
						tags = v.Get.Tags
						break
					}
				}
				// tags = append(tags, "not-k8s")

				for _, route := range routes.Root {
					// Use the same tags as the other operations
					operationVisitor(route.Spec, func(op *spec3.Operation) {
						if op.Tags == nil {
							op.Tags = tags
						}
					})

					copy.Paths.Paths[prefix+route.Path] = &spec3.Path{
						PathProps: *route.Spec,
					}
				}

				for _, route := range routes.Namespace {
					// Use the same tags as the other operations
					operationVisitor(route.Spec, func(op *spec3.Operation) {
						if op.Tags == nil {
							op.Tags = tags
						}
					})

					copy.Paths.Paths[prefix+"/namespaces/{namespace}"+route.Path] = &spec3.Path{
						PathProps: *route.Spec,
					}
				}

				if routes.PostProcessSpec3 != nil {
					return routes.PostProcessSpec3(&copy)
				}

				return &copy, nil
			}
		}
		return s, nil
	}
}

func operationVisitor(p *spec3.PathProps, visitor func(v *spec3.Operation)) {
	if p.Get != nil {
		visitor(p.Get)
	}
	if p.Delete != nil {
		visitor(p.Delete)
	}
	if p.Put != nil {
		visitor(p.Put)
	}
	if p.Head != nil {
		visitor(p.Head)
	}
	if p.Options != nil {
		visitor(p.Options)
	}
	if p.Post != nil {
		visitor(p.Post)
	}
	if p.Patch != nil {
		visitor(p.Patch)
	}
	if p.Trace != nil {
		visitor(p.Trace)
	}
}
