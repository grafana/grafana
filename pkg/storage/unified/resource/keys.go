package resource

import (
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// verifyRequestKey verifies that the key is valid for a request (all fields set and valid, including name)
func verifyRequestKey(key *resourcepb.ResourceKey) *resourcepb.ErrorResult {
	if err := verifyRequestKeyNamespaceGroupResource(key); err != nil {
		return NewBadRequestError(err.Message)
	}
	if err := validation.IsValidGrafanaName(key.Name); err != nil {
		return NewBadRequestError(err[0])
	}
	return nil
}

// verifyRequestKeyCollection verifies that the key is valid for a collection (namespace/group/resource set and valid)
func verifyRequestKeyCollection(key *resourcepb.ResourceKey) *resourcepb.ErrorResult {
	return verifyRequestKeyNamespaceGroupResource(key)
}

// verifyRequestKeyNamespaceGroupResource verifies that the key has namespace/group/resource set and valid
func verifyRequestKeyNamespaceGroupResource(key *resourcepb.ResourceKey) *resourcepb.ErrorResult {
	if key == nil {
		return NewBadRequestError("missing resource key")
	}
	if key.Group == "" {
		return NewBadRequestError("request key is missing group")
	}
	if key.Resource == "" {
		return NewBadRequestError("request key is missing resource")
	}
	if key.Namespace != "" {
		if err := validation.IsValidNamespace(key.Namespace); err != nil {
			return NewBadRequestError(err[0])
		}
	}
	if err := validation.IsValidGroup(key.Group); err != nil {
		return NewBadRequestError(err[0])
	}
	if err := validation.IsValidResource(key.Resource); err != nil {
		return NewBadRequestError(err[0])
	}
	return nil
}

func matchesQueryKey(query *resourcepb.ResourceKey, key *resourcepb.ResourceKey) bool {
	if query.Group != key.Group {
		return false
	}
	if query.Resource != key.Resource {
		return false
	}
	if query.Namespace != "" && query.Namespace != key.Namespace {
		return false
	}
	if query.Name != "" && query.Name != key.Name {
		return false
	}
	return true
}

const clusterNamespace = "**cluster**"

// The namespace/group/resource
func NSGR(x *resourcepb.ResourceKey) string {
	var sb strings.Builder
	appendNSGR(&sb, x)
	return sb.String()
}

func appendNSGR(sb *strings.Builder, x *resourcepb.ResourceKey) string {
	if x.Namespace == "" {
		sb.WriteString(clusterNamespace)
	} else {
		sb.WriteString(x.Namespace)
	}
	sb.WriteString("/")
	sb.WriteString(x.Group)
	sb.WriteString("/")
	sb.WriteString(x.Resource)
	return sb.String()
}

func nsgrWithName(x *resourcepb.ResourceKey) string {
	var sb strings.Builder
	appendNSGR(&sb, x)
	sb.WriteString("/")
	sb.WriteString(x.Name)
	return sb.String()
}
