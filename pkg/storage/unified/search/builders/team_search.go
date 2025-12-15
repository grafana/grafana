package builders

import (
	"bytes"
	"context"
	"encoding/json"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	TEAM_SEARCH_EMAIL        = "email"
	TEAM_SEARCH_PROVISIONED  = "provisioned"
	TEAM_SEARCH_EXTERNAL_UID = "externalUID"
)

var TeamSearchTableColumnDefinitions = map[string]*resourcepb.ResourceTableColumnDefinition{
	TEAM_SEARCH_EMAIL: {
		Name:        TEAM_SEARCH_EMAIL,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "Email of the team",
	},
	TEAM_SEARCH_PROVISIONED: {
		Name:        TEAM_SEARCH_PROVISIONED,
		Type:        resourcepb.ResourceTableColumnDefinition_BOOLEAN,
		Description: "Whether the team is provisioned",
	},
	TEAM_SEARCH_EXTERNAL_UID: {
		Name:        TEAM_SEARCH_EXTERNAL_UID,
		Type:        resourcepb.ResourceTableColumnDefinition_STRING,
		Description: "External UID of the team",
	},
}

func GetTeamSearchBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(TeamSearchTableColumnDefinitions))
	for _, v := range TeamSearchTableColumnDefinitions {
		values = append(values, v)
	}
	fields, err := resource.NewSearchableDocumentFields(values)

	return resource.DocumentBuilderInfo{
		GroupResource: schema.GroupResource{
			Group:    "iam.grafana.app",
			Resource: "searchTeams",
		},
		Fields:  fields,
		Builder: new(teamSearchBuilder),
	}, err
}

var _ resource.DocumentBuilder = new(teamSearchBuilder)

type teamSearchBuilder struct{}

func (t *teamSearchBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	team := &v0alpha1.Team{}
	err := json.NewDecoder(bytes.NewReader(value)).Decode(team)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(team)
	if err != nil {
		return nil, err
	}

	doc := resource.NewIndexableDocument(key, rv, obj)

	doc.Fields = make(map[string]any)
	if team.Spec.Email != "" {
		doc.Fields[TEAM_SEARCH_EMAIL] = team.Spec.Email
	}
	if team.Spec.Provisioned {
		doc.Fields[TEAM_SEARCH_PROVISIONED] = team.Spec.Provisioned
	}
	if team.Spec.ExternalUID != "" {
		doc.Fields[TEAM_SEARCH_EXTERNAL_UID] = team.Spec.ExternalUID
	}

	return doc, nil
}
