package builders

import (
	"context"

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

func GetExternalGroupMappingBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(ExternalGroupMappingTableColumnDefinitions))
	for _, v := range ExternalGroupMappingTableColumnDefinitions {
		values = append(values, v)
	}

	fields, err := resource.NewSearchableDocumentFields(values)
	return resource.DocumentBuilderInfo{
		GroupResource: iamv0.ExternalGroupMappingResourceInfo.GroupResource(),
		Fields:        fields,
		Builder:       new(extGroupMappingDocumentBuilder),
	}, err
}

var _ resource.DocumentBuilder = new(extGroupMappingDocumentBuilder)

type extGroupMappingDocumentBuilder struct{}

// BuildDocument implements resource.DocumentBuilder.
func (u *extGroupMappingDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	extGroupMapping := &iamv0.ExternalGroupMapping{}
	doc, err := NewIndexableDocumentFromValue(key, rv, value, extGroupMapping, iamv0.ExternalGroupMappingKind())
	if err != nil {
		return nil, err
	}

	if extGroupMapping.Spec.TeamRef.Name != "" {
		doc.Fields[EXTERNAL_GROUP_MAPPING_TEAM] = extGroupMapping.Spec.TeamRef.Name
	}
	if extGroupMapping.Spec.ExternalGroupId != "" {
		doc.Fields[EXTERNAL_GROUP_MAPPING_EXTERNAL_GROUP] = extGroupMapping.Spec.ExternalGroupId
	}

	return doc, nil
}
