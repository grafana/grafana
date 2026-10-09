package contract

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const clusterNamespace = "**cluster**"

// LowerGroupResource is a schema.GroupResource with lower-cased Group and
// Resource. A distinct type so keys can only be built via NewLowerGroupResource;
// it keys the search-fields wiring maps.
type LowerGroupResource schema.GroupResource

// NewLowerGroupResource returns a LowerGroupResource, lower-casing group and
// resource so lookups are case-insensitive.
func NewLowerGroupResource(group, resource string) LowerGroupResource {
	return LowerGroupResource{Group: strings.ToLower(group), Resource: strings.ToLower(resource)}
}

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
