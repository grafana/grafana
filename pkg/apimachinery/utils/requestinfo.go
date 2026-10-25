package utils

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/validate/content"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// NewRequestInfo parses a request in the /apis tree as the apiserver's
// RequestInfoFactory does, so routing can match on the resource and verb
// before any apiserver sees the request. It differs in four ways:
//
//   - Only /apis/<group>/<version>/... is a resource path; there is no
//     groupless /api prefix.
//   - The deprecated /apis/<group>/<version>/watch/... form is a BadRequest
//     error rather than a watch; clients watch with ?watch=true.
//   - /apis/<group> and /apis/<group>/<version> are still non-resource
//     requests, but report their APIGroup and APIVersion, so group discovery
//     can be routed by group.
//   - Watches are read from the watch parameter alone, and a field selector
//     names an object whenever it parses, whatever the other list options
//     hold, so a malformed list option is never logged.
//   - A path in the /apis tree that is not canonical (see IsCanonicalAPIPath)
//     is a BadRequest error, since what it was parsed as may not be what a
//     backend serves.
//
// As with RequestInfoFactory, when err is not nil the RequestInfo holds what
// was parsed before the failure.
func NewRequestInfo(req *http.Request) (*request.RequestInfo, error) {
	info := &request.RequestInfo{
		Path: req.URL.Path,
		Verb: LowerMethod(req.Method),
	}

	// Checked before splitting, which allocates.
	if !strings.HasPrefix(strings.TrimLeft(req.URL.Path, "/"), apisPrefix[1:]) {
		return info, nil
	}
	parts, ok := canonicalPathParts(req.URL)
	if !ok {
		return info, errors.NewBadRequest("non-canonical API path")
	}
	if len(parts) < 2 || parts[0] != strings.Trim(apisPrefix, "/") {
		return info, nil
	}
	info.APIPrefix = parts[0]
	info.APIGroup = parts[1]
	if len(parts) < 3 {
		return info, nil
	}
	info.APIVersion = parts[2]
	if len(parts) < 4 {
		return info, nil
	}
	info.IsResourceRequest = true
	parts = parts[3:]

	// Legacy watch is not supported
	if parts[0] == VerbWatch {
		return info, errors.NewBadRequest("legacy watch not supported")
	}

	// /proxy/...
	if parts[0] == "proxy" {
		if len(parts) < 2 {
			return info, fmt.Errorf("unable to determine kind and namespace from url, %v", req.URL)
		}
		info.Verb = parts[0]
		parts = parts[1:]
	} else {
		switch req.Method {
		case http.MethodPost:
			info.Verb = VerbCreate
		case http.MethodGet, http.MethodHead:
			info.Verb = VerbGet
		case http.MethodPut:
			info.Verb = VerbUpdate
		case http.MethodPatch:
			info.Verb = VerbPatch
		case http.MethodDelete:
			info.Verb = VerbDelete
		default:
			info.Verb = ""
		}
	}

	// /namespaces/{namespace}/{resource}/..., unless what follows the
	// namespace is one of the namespace's own subresources.
	if parts[0] == "namespaces" {
		if len(parts) > 1 {
			info.Namespace = parts[1]
			if len(parts) > 2 && parts[2] != "status" && parts[2] != "finalize" {
				parts = parts[2:]
			}
		}
	} else {
		info.Namespace = metav1.NamespaceNone
	}

	// {resource}/{name}/{subresource}/...
	info.Parts = parts
	switch {
	case len(parts) >= 3 && info.Verb != "proxy":
		info.Subresource = parts[2]
		fallthrough
	case len(parts) >= 2:
		info.Name = parts[1]
		fallthrough
	case len(parts) >= 1:
		info.Resource = parts[0]
	}

	// Only a collection request reads the query: a get or delete without a
	// name is a list, watch or deletecollection, and those take selectors.
	// Parsing it allocates, so other requests skip it.
	if info.Name != "" || (info.Verb != VerbGet && info.Verb != VerbDelete) {
		return info, nil
	}
	var query url.Values
	if req.URL.RawQuery != "" {
		query = req.URL.Query()
	}
	if info.Verb == VerbGet {
		info.Verb = VerbList
		if isWatch(query) {
			info.Verb = VerbWatch
		}
		if values := query["fieldSelector"]; len(values) > 0 {
			if selector, err := fields.ParseSelector(values[0]); err == nil {
				if name, ok := selector.RequiresExactMatch("metadata.name"); ok && len(content.IsPathSegmentName(name)) == 0 {
					info.Name = name
				}
			}
		}
	} else {
		info.Verb = VerbDeleteCollection
	}
	if values := query["fieldSelector"]; len(values) > 0 {
		info.FieldSelector = values[0]
	}
	if values := query["labelSelector"]; len(values) > 0 {
		info.LabelSelector = values[0]
	}
	return info, nil
}

// LowerMethod returns method in lower case, as a non-resource request's verb.
// The standard methods return constants, since lowercasing builds a new
// string and every request reads its verb.
func LowerMethod(method string) string {
	switch method {
	case http.MethodGet:
		return "get"
	case http.MethodHead:
		return "head"
	case http.MethodPost:
		return "post"
	case http.MethodPut:
		return "put"
	case http.MethodPatch:
		return "patch"
	case http.MethodDelete:
		return "delete"
	case http.MethodOptions:
		return "options"
	case http.MethodConnect:
		return "connect"
	case http.MethodTrace:
		return "trace"
	}
	return strings.ToLower(method)
}

// isWatch reads the watch parameter as the apiserver decodes a bool list
// option: anything but "0" or "false" is true.
func isWatch(query map[string][]string) bool {
	values := query["watch"]
	return len(values) > 0 && values[0] != "0" && !strings.EqualFold(values[0], "false")
}
