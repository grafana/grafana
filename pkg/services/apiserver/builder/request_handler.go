package builder

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	restclient "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/spec3"
)

type requestHandler struct {
	router *mux.Router
}

func GetCustomRoutesHandler(delegateHandler http.Handler, restConfig *restclient.Config, builders []APIGroupBuilder) (http.Handler, error) {
	useful := false // only true if any routes exist anywhere
	router := mux.NewRouter()

	for _, builder := range builders {
		provider, ok := builder.(APIGroupRouteProvider)
		if !ok || provider == nil {
			continue
		}

		for _, gv := range GetGroupVersions(builder) {
			routes := provider.GetAPIRoutes(gv)
			if routes == nil {
				continue
			}

			prefix := "/apis/" + gv.String()

			// Root handlers
			var sub *mux.Router
			for _, route := range routes.Root {
				if sub == nil {
					sub = router.PathPrefix(prefix).Subrouter()
					sub.MethodNotAllowedHandler = &methodNotAllowedHandler{}
				}

				useful = true
				methods, err := methodsFromSpec(route.Path, route.Spec)
				if err != nil {
					return nil, err
				}
				sub.HandleFunc("/"+route.Path, route.Handler).
					Methods(methods...)
			}

			// Namespace handlers
			sub = nil
			prefix += "/namespaces/{namespace}"
			for _, route := range routes.Namespace {
				if sub == nil {
					sub = router.PathPrefix(prefix).Subrouter()
					sub.MethodNotAllowedHandler = &methodNotAllowedHandler{}
				}

				useful = true
				methods, err := methodsFromSpec(route.Path, route.Spec)
				if err != nil {
					return nil, err
				}
				sub.HandleFunc("/"+route.Path, route.Handler).
					Methods(methods...)
			}
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
