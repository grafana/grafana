package pluginroute

import (
	"fmt"
	"maps"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	claims "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type customRoutes struct{ router *mux.Router }

func newCustomRoutes(plugin definition.PluginDefinition, b *appplugin.AppPluginAPIBuilder, auth authorizer.Authorizer) (*customRoutes, error) {
	router := mux.NewRouter()
	routes := &customRoutes{router: router}
	if plugin.Manifest == nil {
		return routes, nil
	}
	for _, version := range plugin.Manifest.Versions {
		if !version.Served {
			continue
		}
		gv := schema.GroupVersion{Group: plugin.Manifest.Group, Version: version.Name}
		for path, props := range version.OpenAPI.Paths {
			if !strings.HasPrefix(path, "/") {
				return nil, fmt.Errorf("route %q must start with /", path)
			}
			relative := strings.TrimPrefix(path, "/")
			namespaced := strings.HasPrefix(relative, "namespaces/{namespace}/")
			if namespaced {
				relative = strings.TrimPrefix(relative, "namespaces/{namespace}/")
			}
			resource := ""
			routePath := relative
			if parent, suffix, ok := strings.Cut(relative, "/{name}/"); ok {
				for _, kind := range version.Kinds {
					if strings.ToLower(kind.Plural) == parent && namespaced == (kind.Scope != kindstore.ClusterScope) {
						resource = parent
						break
					}
				}
				if resource == "" {
					return nil, fmt.Errorf("route %q has no matching parent kind", path)
				}
				routePath = suffix
			}
			root, _, _ := strings.Cut(relative, "/")
			if root == "app" {
				return nil, fmt.Errorf("route %q shadows settings storage", path)
			}
			for _, kind := range version.Kinds {
				if root == strings.ToLower(kind.Plural) && resource == "" {
					return nil, fmt.Errorf("route %q shadows resource storage", path)
				}
			}
			if resource != "" {
				subresource, _, _ := strings.Cut(routePath, "/")
				if subresource == "status" || subresource == "" {
					return nil, fmt.Errorf("route %q shadows a reserved subresource", path)
				}
			}
			if strings.Contains(routePath, "{name}") {
				return nil, fmt.Errorf("route %q has an invalid parent path", path)
			}
			for method, op := range builder.GetPathOperations(&props) {
				handler, err := authorizeCustomRoute(gv, op, auth, b.CustomRouteHandler(gv, resource, routePath))
				if err != nil {
					return nil, fmt.Errorf("%s %s: %w", method, path, err)
				}
				route := router.Handle("/apis/"+gv.String()+path, handler).Methods(method)
				if err := route.GetError(); err != nil {
					return nil, err
				}
			}
		}
	}
	return routes, nil
}

func (c *customRoutes) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var match mux.RouteMatch
		if c.router.Match(r, &match) || match.MatchErr == mux.ErrMethodMismatch {
			c.router.ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func authorizeCustomRoute(gv schema.GroupVersion, op *spec3.Operation, auth authorizer.Authorizer, next http.Handler) (http.Handler, error) {
	declared := map[string]string{}
	for _, key := range []string{"verb", "resource", "subresource"} {
		extension := "x-grafana-declared-authz-" + key
		if value, exists := op.Extensions[extension]; exists {
			text, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("%s must be a string", extension)
			}
			declared[key] = text
		}
	}
	if len(declared) > 0 && declared["resource"] == "" {
		return nil, fmt.Errorf("declared authorization requires a resource")
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := request.WithNamespace(r.Context(), mux.Vars(r)["namespace"])
		r = r.WithContext(ctx)
		if len(declared) > 0 {
			if auth == nil {
				_ = errhttp.Write(ctx, apierrors.NewServiceUnavailable("custom route authorization is not configured"), w)
				return
			}
			verb := declared["verb"]
			if verb == "" {
				verb = strings.ToLower(r.Method)
			}
			namespace := request.NamespaceValue(ctx)
			if namespace == "" {
				// Declared permissions belong to the caller's tenant even when
				// the route itself has no namespace segment.
				if ident, ok := claims.AuthInfoFrom(ctx); ok {
					namespace = ident.GetNamespace()
				}
			}
			user, _ := request.UserFrom(ctx)
			attr := authorizer.AttributesRecord{
				User: user, Verb: verb, APIGroup: gv.Group, APIVersion: gv.Version,
				Resource: declared["resource"], Subresource: declared["subresource"],
				Namespace: namespace, Name: mux.Vars(r)["name"],
				ResourceRequest: true, Path: r.URL.Path,
			}
			decision, reason, err := auth.Authorize(ctx, attr)
			if err != nil {
				_ = errhttp.Write(ctx, apierrors.NewInternalError(err), w)
				return
			}
			if decision != authorizer.DecisionAllow {
				_ = errhttp.Write(ctx, apierrors.NewForbidden(gv.WithResource(attr.Resource).GroupResource(), attr.Name, fmt.Errorf("custom route access denied: %s", reason)), w)
				return
			}
		}
		next.ServeHTTP(w, r)
	}), nil
}

func addCustomRouteOpenAPI(doc *spec3.OpenAPI, plugin definition.PluginDefinition) {
	if plugin.Manifest == nil || doc.Info == nil {
		return
	}
	for _, version := range plugin.Manifest.Versions {
		gv := plugin.Manifest.Group + "/" + version.Name
		if !version.Served || doc.Info.Title != gv || len(version.OpenAPI.Paths) == 0 {
			continue
		}
		if doc.Paths == nil {
			doc.Paths = &spec3.Paths{}
		}
		if doc.Paths.Paths == nil {
			doc.Paths.Paths = map[string]*spec3.Path{}
		}
		for path, props := range version.OpenAPI.Paths {
			doc.Paths.Paths["/apis/"+gv+path] = &spec3.Path{PathProps: props}
		}
		if doc.Components == nil {
			doc.Components = &spec3.Components{}
		}
		if doc.Components.Schemas == nil {
			doc.Components.Schemas = map[string]*spec.Schema{}
		}
		for name, schema := range version.OpenAPI.Components.Schemas {
			if _, exists := doc.Components.Schemas[name]; !exists {
				doc.Components.Schemas[name] = &schema
			}
		}
		if doc.Components.Responses == nil {
			doc.Components.Responses = map[string]*spec3.Response{}
		}
		maps.Copy(doc.Components.Responses, version.OpenAPI.Components.Responses)
		if doc.Components.Examples == nil {
			doc.Components.Examples = map[string]*spec3.Example{}
		}
		maps.Copy(doc.Components.Examples, version.OpenAPI.Components.Examples)
	}
}
