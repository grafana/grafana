package authorizer

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
)

// IsSearchRequest reports whether attr is a call to a kind's search or trash
// endpoint. Kubernetes parses those as a create on an object named after the
// segment; a real create posts to the collection and so carries no name.
//
// Exported because the multi-tenant apiserver has its own chain and has to apply
// the same rule.
func IsSearchRequest(attr authorizer.Attributes) bool {
	if !attr.IsResourceRequest() || attr.GetVerb() != "create" || attr.GetSubresource() != "" {
		return false
	}
	switch attr.GetName() {
	case searchv0.SearchPathSegment, searchv0.TrashPathSegment:
		return true
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
		Subresource:     attr.GetSubresource(),
		ResourceRequest: true,
		Path:            attr.GetPath(),

		FieldSelectorRequirements: fieldSelector,
		FieldSelectorParsingErr:   fieldErr,
		LabelSelectorRequirements: labelSelector,
		LabelSelectorParsingErr:   labelErr,
	}
}
