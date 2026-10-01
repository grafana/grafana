package authorizer

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/services/apiserver/kvregistry"
)

// IsKVRequest reports whether attr is a kv or kv:batch subresource request on
// a kind that has kv mounted (declaring kinds only, tracked by the kvregistry).
//
// Exported so that other authorizer chains (e.g. the multi-tenant apiserver) can
// apply the same parent-get rewrite without duplicating the detection logic.
func IsKVRequest(attr authorizer.Attributes) bool {
	if !attr.IsResourceRequest() {
		return false
	}
	sub := attr.GetSubresource()
	if sub != "kv" && sub != "kv:batch" {
		return false
	}
	return kvregistry.HasKV(attr.GetAPIGroup(), attr.GetResource())
}

// AsParentGetAttributes rewrites a kv or kv:batch request as a get on the
// parent resource. Clearing the subresource causes the normal group authorizer
// and RBAC chain to check parent-read permission rather than
// issuing a blanket allow. This applies to all HTTP verbs: kv writes also
// require parent read at this layer; kv:write ownership is still enforced
// inside the KVConnector.
func AsParentGetAttributes(attr authorizer.Attributes) authorizer.Attributes {
	fieldSelector, fieldErr := attr.GetFieldSelector()
	labelSelector, labelErr := attr.GetLabelSelector()
	return authorizer.AttributesRecord{
		User:            attr.GetUser(),
		Verb:            "get",
		Namespace:       attr.GetNamespace(),
		APIGroup:        attr.GetAPIGroup(),
		APIVersion:      attr.GetAPIVersion(),
		Resource:        attr.GetResource(),
		Subresource:     "",
		Name:            attr.GetName(),
		ResourceRequest: true,
		Path:            attr.GetPath(),

		FieldSelectorRequirements: fieldSelector,
		FieldSelectorParsingErr:   fieldErr,
		LabelSelectorRequirements: labelSelector,
		LabelSelectorParsingErr:   labelErr,
	}
}
