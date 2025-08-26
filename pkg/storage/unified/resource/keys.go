package resource

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func verifyRequestKey(key *resourcepb.ResourceKey) *resourcepb.ErrorResult {
	if key == nil {
		return NewBadRequestError("missing resource key")
	}
	if key.Group == "" {
		return NewBadRequestError("request key is missing group")
	}
	if key.Resource == "" {
		return NewBadRequestError("request key is missing resource")
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

// Convert the key to a search ID string
func SearchID(x *resourcepb.ResourceKey) string {
	var sb strings.Builder
	if x.Namespace == "" {
		sb.WriteString(clusterNamespace)
	} else {
		sb.WriteString(x.Namespace)
	}
	sb.WriteString("/")
	sb.WriteString(x.Group)
	sb.WriteString("/")
	sb.WriteString(x.Resource)
	if x.Name != "" {
		sb.WriteString("/")
		sb.WriteString(x.Name)
	}
	return sb.String()
}

func ReadSearchID(x *resourcepb.ResourceKey, v string) error {
	parts := strings.Split(v, "/")
	if len(parts) < 3 {
		return fmt.Errorf("invalid search id (expecting 3 slashes)")
	}

	x.Namespace = parts[0]
	x.Group = parts[1]
	x.Resource = parts[2]
	if len(parts) > 3 {
		x.Name = parts[3]
	}

	if x.Namespace == clusterNamespace {
		x.Namespace = ""
	}
	return nil
}

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
