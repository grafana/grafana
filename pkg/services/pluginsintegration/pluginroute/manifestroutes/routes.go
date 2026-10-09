// Package manifestroutes resolves and validates the custom routes an app
// manifest declares in each version's OpenAPI paths.
//
// The router serves these routes, but the rules for which paths are valid
// belong to the manifest, so a manifest can be checked when it is generated
// rather than when it is loaded. The package depends only on the standard
// library, the app-sdk app package and kube-openapi, so it can be copied into
// the app-sdk as is.
package manifestroutes

import (
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
)

const (
	// NamespaceParameter is the path parameter carrying the namespace on routes
	// mounted under namespaces/{namespace}.
	NamespaceParameter = "namespace"

	// NameParameter is the path parameter carrying the parent object's name on
	// a kind subresource route.
	NameParameter = "name"

	// CatchAllExtension names the final path parameter of an operation that
	// matches the rest of the path, including slashes. It is how a catch-all is
	// written in OpenAPI, which has no syntax for one.
	CatchAllExtension = "x-grafana-catch-all"

	// NamespacedPrefix is the version-relative path namespaced routes mount
	// under.
	NamespacedPrefix = "namespaces/{" + NamespaceParameter + "}"

	clusterScope = "Cluster"
)

// reservedSubresources are served for every kind, so a kind route may not
// claim them.
var reservedSubresources = map[string]bool{"status": true}

// Options adapt the rules to the server hosting the routes.
type Options struct {
	// ReservedResources are path roots the server serves itself in every
	// version, in addition to the version's own kinds.
	ReservedResources []string

	// UnservedMethods are methods the server does not serve. An operation for
	// one is reported and left out of the route.
	UnservedMethods []string
}

// Route is one declared path, resolved to where it mounts.
type Route struct {
	// Declared is the path as the manifest declares it, relative to the version.
	Declared string

	// Path is relative to where the route mounts: the version, or
	// namespaces/{namespace} when Namespaced.
	Path       string
	Namespaced bool

	// Kind is set for a subresource route of a single object of that kind, and
	// Subresource is the part of the path below {name}.
	Kind        *app.ManifestVersionKind
	Subresource string

	// CatchAll names the final parameter when it matches the rest of the path.
	CatchAll string

	// Pattern is the net/http ServeMux pattern matching the route, relative to
	// the version, without a method.
	Pattern string

	// SpecPath is the path to publish in an OpenAPI document, relative to the
	// version. A catch-all is published as an ordinary parameter.
	SpecPath string

	// Operations are the declared operations, without unserved methods.
	Operations spec3.PathProps
}

// VersionPath is the route's path relative to the version.
func (r Route) VersionPath() string {
	if r.Namespaced {
		return NamespacedPrefix + "/" + r.Path
	}
	return r.Path
}

// Problem is a declared path, or one of its methods, that cannot be served.
type Problem struct {
	Version string
	Path    string
	// Method is set when only that operation is left out.
	Method string
	Reason string
}

func (p Problem) Error() string {
	at := p.Path
	if p.Method != "" {
		at = p.Method + " " + at
	}
	if p.Version != "" {
		at = p.Version + " " + at
	}
	return at + ": " + p.Reason
}

// Validate reports every problem in every version of a manifest.
func Validate(manifest *app.ManifestData, opts Options) error {
	if manifest == nil {
		return nil
	}
	var errs []error
	for _, version := range manifest.Versions {
		_, problems := Parse(version, opts)
		for _, p := range problems {
			errs = append(errs, p)
		}
	}
	return errors.Join(errs...)
}

// Parse resolves the paths in a version's OpenAPI section, in path order. A
// path that cannot be served is reported and left out, and of two paths
// matching the same requests the first is kept.
func Parse(version app.ManifestVersion, opts Options) ([]Route, []Problem) {
	reserved := map[string]bool{}
	for _, name := range opts.ReservedResources {
		reserved[strings.ToLower(name)] = true
	}
	kinds := map[string]*app.ManifestVersionKind{}
	for i := range version.Kinds {
		if plural := strings.ToLower(version.Kinds[i].Plural); plural != "" {
			kinds[plural] = &version.Kinds[i]
		}
	}

	var problems []Problem
	report := func(path, method, reason string) {
		problems = append(problems, Problem{Version: version.Name, Path: path, Method: method, Reason: reason})
	}

	declared := version.OpenAPI.Paths
	routes := make([]Route, 0, len(declared))
	probe := http.NewServeMux()
	for _, full := range slices.Sorted(maps.Keys(declared)) {
		ops := withoutMethods(declared[full], opts.UnservedMethods, func(method string) {
			report(full, method, "the method is not served")
		})
		if len(Operations(&ops)) == 0 {
			report(full, "", "no operation is served")
			continue
		}
		route := Route{Declared: full, Path: strings.TrimPrefix(full, "/"), Operations: ops}
		if rest, ok := strings.CutPrefix(route.Path, NamespacedPrefix+"/"); ok {
			route.Path = rest
			route.Namespaced = true
		}

		if reason := route.resolve(kinds, reserved); reason != "" {
			report(full, "", reason)
			continue
		}
		if reason := route.parsePattern(); reason != "" {
			report(full, "", reason)
			continue
		}
		if reason := mountable(probe, route, routes); reason != "" {
			report(full, "", reason)
			continue
		}
		routes = append(routes, route)
	}
	return routes, problems
}

// resolve decides what the route mounts under, returning why it cannot be
// served if it would shadow something the server serves.
func (r *Route) resolve(kinds map[string]*app.ManifestVersionKind, reserved map[string]bool) string {
	root, below, _ := strings.Cut(r.Path, "/")
	if kind := kinds[root]; kind != nil {
		sub, ok := strings.CutPrefix(below, "{"+NameParameter+"}/")
		first, _, _ := strings.Cut(sub, "/")
		switch {
		case !ok:
			return "shadows the " + root + " resource; a kind route must be below " + root + "/{" + NameParameter + "}/"
		case r.Namespaced == (kind.Scope == clusterScope):
			if r.Namespaced {
				return kind.Kind + " is cluster scoped, so its routes cannot be under " + NamespacedPrefix
			}
			return kind.Kind + " is namespaced, so its routes must be under " + NamespacedPrefix
		case first == "":
			return "a kind route needs a subresource below " + root + "/{" + NameParameter + "}/"
		case reservedSubresources[first]:
			return "shadows the " + first + " subresource every kind has"
		}
		r.Kind = kind
		r.Subresource = sub
		return ""
	}
	switch {
	case root == "":
		return "shadows the version root"
	case reserved[root]:
		return "shadows the " + root + " resource"
	case !r.Namespaced && root == "namespaces":
		return "only a route under " + NamespacedPrefix + "/ may start with namespaces"
	}
	return ""
}

// parsePattern sets the ServeMux pattern and published path, returning why the
// path cannot be matched.
//
// ServeMux only accepts wildcard names that are Go identifiers, and each name
// once, which OpenAPI does not require ({flag-key} is a valid parameter). Only
// the namespace and the parent's name are read back from a match, and the
// handler gets the raw URL, so every other wildcard is renamed by position.
func (r *Route) parsePattern() string {
	versionPath := r.VersionPath()
	segments := strings.Split(versionPath, "/")
	last := len(segments) - 1

	extension, err := catchAllExtension(&r.Operations)
	if err != nil {
		return err.Error()
	}

	pattern := make([]string, len(segments))
	published := make([]string, len(segments))
	for i, segment := range segments {
		pattern[i], published[i] = segment, segment
		if segment == "." || segment == ".." || (segment == "" && i != last) {
			return "is not a clean path"
		}
		name, isParam := parameterName(segment)
		if !isParam {
			if strings.ContainsAny(segment, "{}") {
				return "a parameter must be a whole path segment: " + segment
			}
			continue
		}
		catchAll, isCatchAll := strings.CutSuffix(name, ":*")
		if !isCatchAll {
			catchAll, isCatchAll = strings.CutSuffix(name, "...")
		}
		if !isCatchAll && extension != "" && name == extension {
			catchAll, isCatchAll = name, true
		}
		switch {
		case !isCatchAll && strings.Contains(name, ":"):
			return "a parameter cannot constrain its value: " + segment
		case isCatchAll && i != last:
			return "only the last segment can match the rest of the path: " + segment
		case isCatchAll:
			r.CatchAll = catchAll
			pattern[i] = fmt.Sprintf("{p%d...}", i)
			published[i] = "{" + catchAll + "}"
		case name == NamespaceParameter || name == NameParameter:
		default:
			pattern[i] = fmt.Sprintf("{p%d}", i)
		}
	}
	if extension != "" && r.CatchAll != extension {
		return CatchAllExtension + " names " + extension + ", which is not the last path segment"
	}

	r.Pattern = strings.Join(pattern, "/")
	if strings.HasSuffix(r.Pattern, "/") {
		r.Pattern += "{$}" // otherwise the pattern matches the whole subtree
	}
	r.SpecPath = strings.Join(published, "/")
	return ""
}

func parameterName(segment string) (string, bool) {
	if len(segment) < 2 || segment[0] != '{' || segment[len(segment)-1] != '}' {
		return "", false
	}
	return segment[1 : len(segment)-1], true
}

// catchAllExtension returns the parameter the operations name as a catch-all.
// The operations of one path share their path, so they must agree.
func catchAllExtension(props *spec3.PathProps) (string, error) {
	name := ""
	ops := Operations(props)
	for _, method := range slices.Sorted(maps.Keys(ops)) {
		value, ok := ops[method].Extensions[CatchAllExtension]
		if !ok {
			continue
		}
		s, ok := value.(string)
		if !ok || s == "" {
			return "", fmt.Errorf("%s on %s must name a path parameter", CatchAllExtension, method)
		}
		if name != "" && name != s {
			return "", fmt.Errorf("operations disagree on %s: %s and %s", CatchAllExtension, name, s)
		}
		name = s
	}
	return name, nil
}

// mountable registers the route on probe, returning why ServeMux refuses it.
// A conflict is reported against the earlier path it conflicts with.
func mountable(probe *http.ServeMux, route Route, earlier []Route) string {
	for _, method := range slices.Sorted(maps.Keys(Operations(&route.Operations))) {
		err := handle(probe, method+" /"+route.Pattern)
		if err == nil {
			continue
		}
		for _, other := range earlier {
			mux := http.NewServeMux()
			for m := range Operations(&other.Operations) {
				_ = handle(mux, m+" /"+other.Pattern)
			}
			if handle(mux, method+" /"+route.Pattern) != nil {
				return "matches the same " + method + " requests as " + other.Declared
			}
		}
		return "cannot be matched: " + err.Error()
	}
	return ""
}

func handle(mux *http.ServeMux, pattern string) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%v", r)
		}
	}()
	mux.Handle(pattern, http.NotFoundHandler())
	return nil
}

// Operations returns the declared operations of a path by method.
func Operations(props *spec3.PathProps) map[string]*spec3.Operation {
	ops := map[string]*spec3.Operation{}
	for method, op := range map[string]*spec3.Operation{
		http.MethodGet: props.Get, http.MethodHead: props.Head, http.MethodPost: props.Post,
		http.MethodPut: props.Put, http.MethodPatch: props.Patch, http.MethodDelete: props.Delete,
		http.MethodOptions: props.Options, http.MethodTrace: props.Trace,
	} {
		if op != nil {
			ops[method] = op
		}
	}
	return ops
}

// withoutMethods returns a copy of props without the operations for methods,
// so the loaded manifest is untouched.
func withoutMethods(props spec3.PathProps, methods []string, removed func(method string)) spec3.PathProps {
	for _, method := range methods {
		var op **spec3.Operation
		switch strings.ToUpper(method) {
		case http.MethodGet:
			op = &props.Get
		case http.MethodHead:
			op = &props.Head
		case http.MethodPost:
			op = &props.Post
		case http.MethodPut:
			op = &props.Put
		case http.MethodPatch:
			op = &props.Patch
		case http.MethodDelete:
			op = &props.Delete
		case http.MethodOptions:
			op = &props.Options
		case http.MethodTrace:
			op = &props.Trace
		default:
			continue
		}
		if *op != nil {
			removed(strings.ToUpper(method))
			*op = nil
		}
	}
	return props
}
