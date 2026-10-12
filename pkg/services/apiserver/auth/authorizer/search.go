package authorizer

import (
	"strings"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
)

// IsSearchRequest reports whether attr is a call to a kind's search or trash
// endpoint, including hybrid search. Kubernetes parses those as a create on an
// object named after the segment, with hybrid as a subresource; a real create
// posts to the collection and so carries no name.
//
// Exported because the multi-tenant apiserver has its own chain and has to apply
// the same rule.
func IsSearchRequest(attr authorizer.Attributes) bool {
	if !attr.IsResourceRequest() || attr.GetVerb() != "create" {
		return false
	}
	switch attr.GetName() {
	case searchv0.SearchPathSegment:
		if attr.GetSubresource() == "" {
			return true
		}
		if attr.GetSubresource() != searchv0.HybridSearchPathSegment || attr.GetNamespace() == "" {
			return false
		}
		// Kubernetes ignores segments after the subresource, which may belong to
		// a custom route rather than the namespaced hybrid endpoint.
		hybridPath := "/apis/" + attr.GetAPIGroup() + "/" + attr.GetAPIVersion() +
			"/namespaces/" + attr.GetNamespace() + "/" + attr.GetResource() +
			"/" + searchv0.SearchPathSegment + "/" + searchv0.HybridSearchPathSegment
		return strings.TrimSuffix(attr.GetPath(), "/") == hybridPath
	case searchv0.TrashPathSegment:
		return attr.GetSubresource() == ""
	default:
		return false
	}
}

// AsReadAttributes restates a search request as the read it performs. Without
// this, searching a kind would demand permission to create it.
func AsReadAttributes(attr authorizer.Attributes) authorizer.Attributes {
	fieldSelector, fieldErr := attr.GetFieldSelector()
	labelSelector, labelErr := attr.GetLabelSelector()
	return authorizer.AttributesRecord{
		User:            attr.GetUser(),
		Verb:            "list",
		Namespace:       attr.GetNamespace(),
		APIGroup:        attr.GetAPIGroup(),
		APIVersion:      attr.GetAPIVersion(),
		Resource:        attr.GetResource(),
		ResourceRequest: true,
		Path:            attr.GetPath(),

		FieldSelectorRequirements: fieldSelector,
		FieldSelectorParsingErr:   fieldErr,
		LabelSelectorRequirements: labelSelector,
		LabelSelectorParsingErr:   labelErr,
	}
}
