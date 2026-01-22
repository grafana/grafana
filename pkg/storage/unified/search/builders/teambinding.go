package builders

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
	TEAM_BINDING_SUBJECT_NAME = "subject_name"
	TEAM_BINDING_TEAM_REF     = "team_ref"
	TEAM_BINDING_PERMISSION   = "permission"
	TEAM_BINDING_EXTERNAL     = "external"
)

var TeamBindingTableColumnDefinitions = map[string]*resourcepb.ResourceTableColumnDefinition{
	TEAM_BINDING_SUBJECT_NAME: {
		Name: TEAM_BINDING_SUBJECT_NAME, Type: resourcepb.ResourceTableColumnDefinition_STRING,
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{Filterable: true},
	},
	TEAM_BINDING_TEAM_REF: {
		Name: TEAM_BINDING_TEAM_REF, Type: resourcepb.ResourceTableColumnDefinition_STRING,
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{Filterable: true},
	},
	TEAM_BINDING_PERMISSION: {
		Name: TEAM_BINDING_PERMISSION, Type: resourcepb.ResourceTableColumnDefinition_STRING,
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{Filterable: false},
	},
	TEAM_BINDING_EXTERNAL: {
		Name: TEAM_BINDING_EXTERNAL, Type: resourcepb.ResourceTableColumnDefinition_BOOLEAN,
		Properties: &resourcepb.ResourceTableColumnDefinition_Properties{Filterable: false},
	},
}

func GetTeamBindingBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(TeamBindingTableColumnDefinitions))
	for _, v := range TeamBindingTableColumnDefinitions {
		values = append(values, v)
	}

	fields, err := resource.NewSearchableDocumentFields(values)
	return resource.DocumentBuilderInfo{
		GroupResource: iamv0.TeamBindingResourceInfo.GroupResource(),
		Fields:        fields,
		Builder:       new(teamBindingDocumentBuilder),
	}, err
}

type teamBindingDocumentBuilder struct{}

func (b *teamBindingDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	tb := &iamv0.TeamBinding{}
	if err := json.NewDecoder(bytes.NewReader(value)).Decode(tb); err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(tb)
	if err != nil {
		return nil, err
	}

	doc := resource.NewIndexableDocument(key, rv, obj)
	doc.Fields = map[string]any{
		TEAM_BINDING_SUBJECT_NAME: tb.Spec.Subject.Name,
		TEAM_BINDING_TEAM_REF:     tb.Spec.TeamRef.Name,
		TEAM_BINDING_PERMISSION:   string(tb.Spec.Permission),
		TEAM_BINDING_EXTERNAL:     tb.Spec.External,
	}

	return doc, nil
}
