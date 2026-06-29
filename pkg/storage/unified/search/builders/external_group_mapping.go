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

var ExternalGroupMappingTableColumnDefinitions = map[string]*resourcepb.ResourceTableColumnDefinition{
	EXTERNAL_GROUP_MAPPING_TEAM: {
		Name:        EXTERNAL_GROUP_MAPPING_TEAM,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "The team name associated with the external group mapping",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			Filterable: true,
		},
	},
	EXTERNAL_GROUP_MAPPING_EXTERNAL_GROUP: {
		Name:        EXTERNAL_GROUP_MAPPING_EXTERNAL_GROUP,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "The external group name/id associated with the external group mapping",
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
			Filterable: true,
		},
	},
}

// ExternalGroupMappingSearchFields declares paths and types for each external
// group mapping search field. The standard document builder uses these to
// extract spec values from the raw JSON, avoiding a custom builder.
var ExternalGroupMappingSearchFields = []resource.SearchFieldDefinition{
	{Name: EXTERNAL_GROUP_MAPPING_TEAM, Path: "spec.teamRef.name", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
	{Name: EXTERNAL_GROUP_MAPPING_EXTERNAL_GROUP, Path: "spec.externalGroupId", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
}

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
