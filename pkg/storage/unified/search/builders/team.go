package builders

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	TEAM_SEARCH_EMAIL        = "email"
	TEAM_SEARCH_PROVISIONED  = "provisioned"
	TEAM_SEARCH_EXTERNAL_UID = "externalUID"
	TEAM_SEARCH_MEMBER_COUNT = "memberCount"
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
	TEAM_SEARCH_MEMBER_COUNT: {
		Name:        TEAM_SEARCH_MEMBER_COUNT,
		Type:        resourcepb.ResourceTableColumnDefinition_INT64,
		Description: "Number of members in the team",
		Properties:  &resourcepb.ResourceTableColumnDefinition_Properties{Filterable: false},
	},
}

type TeamMemberCountLookup func(ctx context.Context, namespace, teamUID string) (int64, error)

func GetTeamSearchBuilder(memberCountLookup TeamMemberCountLookup) (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(TeamSearchTableColumnDefinitions))
	for _, v := range TeamSearchTableColumnDefinitions {
		values = append(values, v)
	}
	fields, err := resource.NewSearchableDocumentFields(values)

	return resource.DocumentBuilderInfo{
		GroupResource: schema.GroupResource{
			Group:    v0alpha1.TeamResourceInfo.GroupResource().Group,
			Resource: v0alpha1.TeamResourceInfo.GroupResource().Resource,
		},
		Fields:  fields,
		Builder: &teamSearchBuilder{MemberCountLookup: memberCountLookup},
	}, err
}

var _ resource.DocumentBuilder = (*teamSearchBuilder)(nil)

type teamSearchBuilder struct {
	MemberCountLookup TeamMemberCountLookup
}

func (t *teamSearchBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	team := &v0alpha1.Team{}
	doc, err := NewIndexableDocumentFromValue(key, rv, value, team, v0alpha1.TeamKind())
	if err != nil {
		return nil, err
	}

	if team.Spec.Email != "" {
		doc.Fields[TEAM_SEARCH_EMAIL] = team.Spec.Email
	}
	if team.Spec.Provisioned {
		doc.Fields[TEAM_SEARCH_PROVISIONED] = team.Spec.Provisioned
	}
	if team.Spec.ExternalUID != "" {
		doc.Fields[TEAM_SEARCH_EXTERNAL_UID] = team.Spec.ExternalUID
	}

	if t.MemberCountLookup != nil && key != nil && key.Name != "" {
		count, err := t.MemberCountLookup(ctx, key.Namespace, key.Name)
		if err == nil {
			doc.Fields[TEAM_SEARCH_MEMBER_COUNT] = count
		}
	}

	return doc, nil
}
