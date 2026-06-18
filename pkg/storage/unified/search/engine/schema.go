package engine

import (
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// FieldDescriptorsFromDefinitions converts internal search field definitions
// into wire descriptors carried on Index requests.
func FieldDescriptorsFromDefinitions(defs []resource.SearchFieldDefinition) []*resourcepb.FieldDescriptor {
	out := make([]*resourcepb.FieldDescriptor, 0, len(defs))
	for _, def := range defs {
		out = append(out, SearchFieldToDescriptor(def))
	}
	return out
}

// SchemaForKind returns the carried schema and hash for a (group, resource).
// When definitions are empty the hash comes from the precomputed map entry.
func SchemaForKind(
	group, resourceName string,
	definitions []resource.SearchFieldDefinition,
	hashByKind map[string]string,
) ([]*resourcepb.FieldDescriptor, string) {
	key := strings.ToLower(group + "/" + resourceName)
	hash := hashByKind[key]
	if len(definitions) == 0 {
		return nil, hash
	}
	return FieldDescriptorsFromDefinitions(definitions), hash
}
