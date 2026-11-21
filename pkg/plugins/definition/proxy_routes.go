package definition

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/routes"
	"github.com/grafana/grafana/pkg/plugins"
)

func proxyTargetOf(route *plugins.Route) routes.ProxyTarget {
	target := routes.ProxyTarget{
		ReqRole:      route.ReqRole,
		ReqAction:    route.ReqAction,
		URL:          route.URL,
		AuthType:     route.AuthType,
		TokenAuth:    proxyTokenAuthOf(route.TokenAuth),
		JwtTokenAuth: proxyTokenAuthOf(route.JwtTokenAuth),
		Body:         route.Body,
	}
	for _, p := range route.URLParams {
		target.URLParams = append(target.URLParams, routes.ProxyURLParam{Name: p.Name, Content: p.Content})
	}
	for _, h := range route.Headers {
		target.Headers = append(target.Headers, routes.ProxyHeader{Name: h.Name, Content: h.Content})
	}
	return target
}

func proxyTokenAuthOf(auth *plugins.JWTTokenAuth) *routes.ProxyTokenAuth {
	if auth == nil {
		return nil
	}
	return &routes.ProxyTokenAuth{URL: auth.Url, Scopes: auth.Scopes, Params: auth.Params}
}

func routeTokenAuthOf(auth *routes.ProxyTokenAuth) *plugins.JWTTokenAuth {
	if auth == nil {
		return nil
	}
	return &plugins.JWTTokenAuth{Url: auth.URL, Scopes: auth.Scopes, Params: auth.Params}
}

// proxyMethods are the methods a route can name.
var proxyMethods = []string{
	http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut,
	http.MethodPatch, http.MethodDelete, http.MethodOptions,
}

// anyMethods are the operations a route that names no method, or "*", is
// converted to. HEAD is left out: as on every app-sdk route, the GET operation
// answers it, and declaring it would conflict with any more specific GET route.
var anyMethods = []string{
	http.MethodGet, http.MethodPost, http.MethodPut,
	http.MethodPatch, http.MethodDelete, http.MethodOptions,
}

// proxyParamName is a parameter name the plugin proxy's router accepts.
var proxyParamName = regexp.MustCompile(`^[a-zA-Z0-9]+$`)

// reservedProxyParams are renamed so the published path does not reuse the
// settings path's parameters, and so a last {path} parameter is not read as
// matching the rest of the path. Generated names contain an underscore, which a
// proxy route's own parameter names cannot, so they never collide.
var reservedProxyParams = map[string]bool{"namespace": true, "name": true, "path": true}

// ProxyRoutesToOpenAPI converts plugin.json proxy routes into OpenAPI paths,
// relative to the proxy root, with each operation's
// routes.ExtensionProxy set. A route is converted only when its path
// uses no more of the plugin proxy's pattern syntax than plain segments, :name
// parameters and *; otherwise an error names the route, and no paths are
// returned.
//
// Routes are matched in the order they are declared, so a route that only
// repeats the path and a method of an earlier one is never reached, and is
// left out.
//
// The converted routes answer HEAD as app-sdk routes do: with the route that
// answers GET, unless a route names HEAD. The plugin proxy instead gives HEAD
// to the first route that names no method, or "*".
func ProxyRoutesToOpenAPI(routes []*plugins.Route) (map[string]spec3.PathProps, error) {
	var errs []error
	paths := map[string]spec3.PathProps{}
	// shapes maps a path, with its parameter names blanked, to the first path
	// declared with that shape: OpenAPI does not allow two paths that differ only
	// in parameter names, and they match the same requests.
	type declared struct {
		specPath string
		params   []string
	}
	shapes := map[string]declared{}
	for i, route := range routes {
		if route == nil {
			continue
		}
		specPath, shape, params, err := proxyOpenAPIPath(route.Path)
		if err != nil {
			errs = append(errs, fmt.Errorf("route %d (%q): %w", i, route.Path, err))
			continue
		}
		methods, err := proxyRouteMethods(route.Method)
		if err != nil {
			errs = append(errs, fmt.Errorf("route %d (%q): %w", i, route.Path, err))
			continue
		}
		if first, ok := shapes[shape]; ok {
			specPath, params = first.specPath, first.params
		} else {
			shapes[shape] = declared{specPath: specPath, params: params}
		}
		props := paths[specPath]
		for _, method := range methods {
			op := operationFor(&props, method)
			if *op != nil {
				continue // an earlier route serves these requests
			}
			*op = proxyOperation(route, params)
		}
		paths[specPath] = props
	}
	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}
	return paths, nil
}

// proxyOpenAPIPath converts a plugin proxy route path to an app-sdk route path.
// shape is the path with its parameter names blanked.
func proxyOpenAPIPath(routePath string) (specPath, shape string, params []string, err error) {
	// The plugin proxy's router drops one leading and one trailing slash from a
	// pattern.
	trimmed := strings.TrimSuffix(strings.TrimPrefix(routePath, "/"), "/")
	if trimmed == "" {
		return "", "", nil, errors.New("a route must name a path below the proxy root")
	}
	segments := strings.Split(trimmed, "/")
	out := make([]string, len(segments))
	shapes := make([]string, len(segments))
	for i, segment := range segments {
		switch {
		case segment == "":
			return "", "", nil, errors.New("a route path cannot have an empty segment")
		case segment == "*" && i == len(segments)-1:
			out[i], shapes[i] = "{path:*}", "{*}"
			params = append(params, "path")
		case segment == "*":
			// The router matches a * before the last segment against one segment only.
			name := "segment_" + strconv.Itoa(i)
			out[i], shapes[i] = "{"+name+"}", "{}"
			params = append(params, name)
		case strings.HasPrefix(segment, ":"):
			name := segment[1:]
			if !proxyParamName.MatchString(name) || name == "int" || name == "string" {
				return "", "", nil, fmt.Errorf("unsupported parameter %q: only :name is converted", segment)
			}
			if reservedProxyParams[name] {
				name += "_"
			}
			out[i], shapes[i] = "{"+name+"}", "{}"
			params = append(params, name)
		case strings.ContainsAny(segment, ":*?(){}"):
			return "", "", nil, fmt.Errorf("unsupported segment %q", segment)
		case segment == "." || segment == "..":
			return "", "", nil, fmt.Errorf("unsupported segment %q", segment)
		default:
			out[i], shapes[i] = segment, segment
		}
	}
	return "/" + strings.Join(out, "/"), "/" + strings.Join(shapes, "/"), params, nil
}

func proxyRouteMethods(method string) ([]string, error) {
	if method == "" || method == "*" {
		return anyMethods, nil
	}
	for _, m := range proxyMethods {
		// The proxy compares methods exactly, so "get" never matched a request.
		if m == method {
			return []string{m}, nil
		}
	}
	return nil, fmt.Errorf("unsupported method %q", method)
}

func proxyOperation(route *plugins.Route, params []string) *spec3.Operation {
	op := &spec3.Operation{OperationProps: spec3.OperationProps{
		Description: "Forwarded by the plugin proxy",
		Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
			Default: &spec3.Response{ResponseProps: spec3.ResponseProps{
				Description: "The proxied response",
			}},
		}},
	}}
	for _, name := range params {
		op.Parameters = append(op.Parameters, &spec3.Parameter{ParameterProps: spec3.ParameterProps{
			Name:     name,
			In:       "path",
			Required: true,
			Schema:   spec.StringProperty(),
		}})
	}
	op.AddExtension(routes.ExtensionProxy, proxyTargetOf(route))
	return op
}

// ProxyRouteFromOperation returns the plugin route an operation declared under
// specPath forwards with, or false when it declares none. specPath is relative
// to the proxy root, as ProxyRoutesToOpenAPI returns it. The route's path is
// rebuilt in the plugin proxy's pattern syntax, with its parameters renamed,
// since the proxy only reads what a final * matches.
func ProxyRouteFromOperation(specPath, method string, op *spec3.Operation) (*plugins.Route, bool, error) {
	target, ok, err := routes.ProxyTargetFromOperation(op)
	if !ok || err != nil {
		return nil, ok, err
	}
	routePath, err := proxyRoutePath(specPath)
	if err != nil {
		return nil, true, err
	}
	route := &plugins.Route{
		Path:         routePath,
		Method:       method,
		ReqRole:      target.ReqRole,
		ReqAction:    target.ReqAction,
		URL:          target.URL,
		AuthType:     target.AuthType,
		TokenAuth:    routeTokenAuthOf(target.TokenAuth),
		JwtTokenAuth: routeTokenAuthOf(target.JwtTokenAuth),
		Body:         target.Body,
	}
	for _, p := range target.URLParams {
		route.URLParams = append(route.URLParams, plugins.URLParam{Name: p.Name, Content: p.Content})
	}
	for _, h := range target.Headers {
		route.Headers = append(route.Headers, plugins.Header{Name: h.Name, Content: h.Content})
	}
	return route, true, nil
}

func proxyRoutePath(specPath string) (string, error) {
	segments := strings.Split(strings.TrimPrefix(specPath, "/"), "/")
	// The last parameter, before any trailing slash, as app-sdk reads a path.
	last := len(segments) - 1
	if last > 0 && segments[last] == "" {
		last--
	}
	for i, segment := range segments {
		if len(segment) < 2 || segment[0] != '{' || segment[len(segment)-1] != '}' {
			if strings.ContainsAny(segment, "{}:*") {
				return "", fmt.Errorf("unsupported segment %q in %s", segment, specPath)
			}
			continue
		}
		name := segment[1 : len(segment)-1]
		// app-sdk also matches the rest of the path with a last {path}.
		if strings.HasSuffix(name, ":*") || strings.HasSuffix(name, "...") || (name == "path" && i == last) {
			if i != last {
				return "", fmt.Errorf("only the last segment can match the rest of %s", specPath)
			}
			segments[i] = "*"
			segments = segments[:i+1] // the * matches a trailing slash too
			break
		}
		segments[i] = ":p" + strconv.Itoa(i)
	}
	return strings.Join(segments, "/"), nil
}

// WithoutProxyExtension returns a copy of props whose operations do not carry
// routes.ExtensionProxy, for publishing. The operations are copied
// because they are shared with the served routes.
func WithoutProxyExtension(props spec3.PathProps) spec3.PathProps {
	out := props
	for _, op := range []**spec3.Operation{
		&out.Get, &out.Head, &out.Delete, &out.Post,
		&out.Put, &out.Patch, &out.Trace, &out.Options,
	} {
		if *op == nil {
			continue
		}
		cp := **op
		var ext spec.Extensions
		for k, v := range cp.Extensions {
			if k == routes.ExtensionProxy {
				continue
			}
			if ext == nil {
				ext = spec.Extensions{}
			}
			ext[k] = v
		}
		cp.Extensions = ext
		*op = &cp
	}
	return out
}

func operationFor(props *spec3.PathProps, method string) **spec3.Operation {
	switch method {
	case http.MethodGet:
		return &props.Get
	case http.MethodHead:
		return &props.Head
	case http.MethodPost:
		return &props.Post
	case http.MethodPut:
		return &props.Put
	case http.MethodPatch:
		return &props.Patch
	case http.MethodDelete:
		return &props.Delete
	case http.MethodOptions:
		return &props.Options
	case http.MethodTrace:
		return &props.Trace
	}
	panic("unexpected method " + method)
}
