package search

import (
	"bytes"
	"context"
	"encoding/json"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	EXTERNAL_GROUP_MAPPING_TEAM_UID       = "team"
	EXTERNAL_GROUP_MAPPING_EXTERNAL_GROUP = "group"
)

var ExternalGroupMappingTableColumnDefinitions = map[string]*resourcepb.ResourceTableColumnDefinition{
	EXTERNAL_GROUP_MAPPING_TEAM_UID: {
		Name:        EXTERNAL_GROUP_MAPPING_TEAM_UID,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "The team UID associated with the external group mapping",
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
	user := &iamv0.ExternalGroupMapping{}
	err := json.NewDecoder(bytes.NewReader(value)).Decode(user)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(user)
	if err != nil {
		return nil, err
	}

	doc := resource.NewIndexableDocument(key, rv, obj)

	doc.Fields = make(map[string]any)
	if user.Spec.TeamRef.Name != "" {
		doc.Fields[EXTERNAL_GROUP_MAPPING_TEAM_UID] = user.Spec.TeamRef.Name
	}
	if user.Spec.ExternalGroupId != "" {
		doc.Fields[EXTERNAL_GROUP_MAPPING_EXTERNAL_GROUP] = user.Spec.ExternalGroupId
	}

	return doc, nil
}
