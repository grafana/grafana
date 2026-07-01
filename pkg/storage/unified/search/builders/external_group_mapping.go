package builders

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	EXTERNAL_GROUP_MAPPING_TEAM           = "team"
	EXTERNAL_GROUP_MAPPING_EXTERNAL_GROUP = "external_group"
)

// ExternalGroupMappingTableColumnDefinitions exposes column-defs by name.
// No legacy SQL backend currently consumes this map for this kind; it is
// kept for symmetry with the other IAM builders.
var ExternalGroupMappingTableColumnDefinitions = tableColumnsByName(ExternalGroupMappingSearchFields)

// ExternalGroupMappingSearchFields are read from the generated IAM manifest,
// where they are declared in apps/iam/kinds/externalgroupmapping.cue.
var ExternalGroupMappingSearchFields = resource.NewManifestBackedProvider(iamManifests).Fields(
	iamv0.ExternalGroupMappingResourceInfo.GroupVersionResource(),
)

func GetExternalGroupMappingBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(ExternalGroupMappingTableColumnDefinitions))
	for _, v := range ExternalGroupMappingTableColumnDefinitions {
		values = append(values, v)
	}
	fields, err := resource.NewSearchableDocumentFields(values)
	if err != nil {
		return resource.DocumentBuilderInfo{}, err
	}

	gvr := iamv0.ExternalGroupMappingResourceInfo.GroupVersionResource()
	provider := resource.NewMapProvider(
		map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
			gvr: ExternalGroupMappingSearchFields,
		},
		map[schema.GroupResource]string{
			gvr.GroupResource(): gvr.Version,
		},
	)

	gr := iamv0.ExternalGroupMappingResourceInfo.GroupResource()
	return resource.DocumentBuilderInfo{
		GroupResource:        gr,
		Fields:               fields,
		Builder:              resource.StandardDocumentBuilderWithFields(iamManifests, provider),
		SearchFieldsHash:     provider.IndexAffectingHash(gr.Group, gr.Resource),
		SearchFieldsProvider: provider,
	}, nil
}
