package definition

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
)

// ExtensionProxy declares, on an OpenAPI operation, the plugin route a matched
// request is forwarded with. Its value is a ProxyTarget. It names upstream hosts
// and secure settings, so it must be removed from any published spec.
const ExtensionProxy = "x-grafana-proxy"

// SettingsProxyPrefix is where an app manifest version declares, in its OpenAPI
// paths, the routes the app settings API's proxy serves. Proxy routes are
// served only there: the settings API answers them, at the URL plugin.json
// routes have always been served at, and the manifest's own API leaves the
// subtree to it.
const SettingsProxyPrefix = "/namespaces/{namespace}/app/instance/proxy/"

// IsSettingsProxyPath reports whether a manifest path declares a settings proxy route.
func IsSettingsProxyPath(path string) bool {
	return strings.HasPrefix(path, SettingsProxyPrefix)
}

// ProxyRoutes returns the routes the app settings API's proxy serves, as OpenAPI
// paths relative to the proxy root, and whether an app manifest declared them.
// Routes a manifest declares replace the plugin.json routes, as a manifest's
// OpenAPI paths replace its deprecated routes. Only one served version of one
// manifest may declare them, since the settings API serves a single version.
func (p PluginDefinition) ProxyRoutes() (paths map[string]spec3.PathProps, declared bool, err error) {
	var from string
	for _, manifest := range p.Manifests {
		if manifest == nil {
			continue
		}
		for _, version := range manifest.Versions {
			if !version.Served {
				continue
			}
			for path, props := range version.OpenAPI.Paths {
				rest, ok := strings.CutPrefix(path, SettingsProxyPrefix)
				if !ok {
					continue
				}
				at := manifest.Group + "/" + version.Name
				if from != "" && from != at {
					return nil, true, fmt.Errorf("proxy routes are declared in both %s and %s; only one version may declare them", from, at)
				}
				from = at
				if paths == nil {
					paths = map[string]spec3.PathProps{}
				}
				paths["/"+rest] = props
			}
		}
	}
	if from != "" {
		return paths, true, nil
	}
	paths, err = ProxyRoutesToOpenAPI(p.JSONData.Routes)
	return paths, false, err
}

// ProxyTarget is everything in a plugin route except where it matches: the path
// comes from the OpenAPI path and the method from the operation.
type ProxyTarget struct {
	ReqRole      identity.RoleType     `json:"reqRole,omitempty"`
	ReqAction    string                `json:"reqAction,omitempty"`
	URL          string                `json:"url,omitempty"`
	URLParams    []plugins.URLParam    `json:"urlParams,omitempty"`
	Headers      []plugins.Header      `json:"headers,omitempty"`
	AuthType     string                `json:"authType,omitempty"`
	TokenAuth    *plugins.JWTTokenAuth `json:"tokenAuth,omitempty"`
	JwtTokenAuth *plugins.JWTTokenAuth `json:"jwtTokenAuth,omitempty"`
	Body         json.RawMessage       `json:"body,omitempty"`
}

func proxyTargetOf(route *plugins.Route) ProxyTarget {
	return ProxyTarget{
		ReqRole:      route.ReqRole,
		ReqAction:    route.ReqAction,
		URL:          route.URL,
		URLParams:    route.URLParams,
		Headers:      route.Headers,
		AuthType:     route.AuthType,
		TokenAuth:    route.TokenAuth,
		JwtTokenAuth: route.JwtTokenAuth,
		Body:         route.Body,
	}
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
// relative to the proxy root, with each operation's ExtensionProxy set. A
// route is converted only when its path uses no more of the plugin proxy's
// pattern syntax than plain segments, :name parameters and *; otherwise an
// error names the route, and no paths are returned.
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
	// The plugin proxy's router drops one trailing slash from a pattern.
	trimmed := strings.TrimSuffix(routePath, "/")
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
	op.AddExtension(ExtensionProxy, proxyTargetOf(route))
	return op
}

// ProxyRouteFromOperation returns the plugin route an operation declared under
// specPath forwards with, or false when it declares none. specPath is relative
// to the proxy root, as ProxyRoutesToOpenAPI returns it. The route's path is
// rebuilt in the plugin proxy's pattern syntax, with its parameters renamed,
// since the proxy only reads what a final * matches.
func ProxyRouteFromOperation(specPath, method string, op *spec3.Operation) (*plugins.Route, bool, error) {
	if op == nil {
		return nil, false, nil
	}
	raw, ok := op.Extensions[ExtensionProxy]
	if !ok {
		return nil, false, nil
	}
	var target ProxyTarget
	switch v := raw.(type) {
	case ProxyTarget:
		// Kept as converted, so the body template is forwarded byte for byte.
		target = v
	default:
		// A spec read from JSON holds the extension as decoded JSON.
		b, err := json.Marshal(v)
		if err != nil {
			return nil, true, fmt.Errorf("invalid %s: %w", ExtensionProxy, err)
		}
		if err := json.Unmarshal(b, &target); err != nil {
			return nil, true, fmt.Errorf("invalid %s: %w", ExtensionProxy, err)
		}
	}
	routePath, err := proxyRoutePath(specPath)
	if err != nil {
		return nil, true, err
	}
	return &plugins.Route{
		Path:         routePath,
		Method:       method,
		ReqRole:      target.ReqRole,
		ReqAction:    target.ReqAction,
		URL:          target.URL,
		URLParams:    target.URLParams,
		Headers:      target.Headers,
		AuthType:     target.AuthType,
		TokenAuth:    target.TokenAuth,
		JwtTokenAuth: target.JwtTokenAuth,
		Body:         target.Body,
	}, true, nil
}

func proxyRoutePath(specPath string) (string, error) {
	segments := strings.Split(strings.TrimPrefix(specPath, "/"), "/")
	for i, segment := range segments {
		if len(segment) < 2 || segment[0] != '{' || segment[len(segment)-1] != '}' {
			if strings.ContainsAny(segment, "{}:*") {
				return "", fmt.Errorf("unsupported segment %q in %s", segment, specPath)
			}
			continue
		}
		name := segment[1 : len(segment)-1]
		if strings.HasSuffix(name, ":*") || strings.HasSuffix(name, "...") {
			if i != len(segments)-1 {
				return "", fmt.Errorf("only the last segment can match the rest of %s", specPath)
			}
			segments[i] = "*"
			continue
		}
		segments[i] = ":p" + strconv.Itoa(i)
	}
	return strings.Join(segments, "/"), nil
}

// WithoutProxyExtension returns a copy of props whose operations do not carry
// ExtensionProxy, for publishing. The operations are copied because they are
// shared with the served routes.
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
			if k == ExtensionProxy {
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
	}
	panic("unexpected method " + method)
}
