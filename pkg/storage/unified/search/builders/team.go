package builders

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	TEAM_SEARCH_EMAIL           = "email"
	TEAM_SEARCH_PROVISIONED     = "provisioned"
	TEAM_SEARCH_EXTERNAL_UID    = "externalUID"
	TEAM_SEARCH_MEMBERS         = "members"
	TEAM_SEARCH_EXTERNAL_GROUPS = "externalGroups"
)

// TeamSortableExtraFields are the additional fields that can be used for sorting team search results.
// Should not include standard fields like title.
var TeamSortableExtraFields = []string{
	TEAM_SEARCH_EMAIL,
}

// TeamSearchTableColumnDefinitions exposes column-defs by name for the
// IAM legacy SQL backend in team/legacy_search.go.
var TeamSearchTableColumnDefinitions = tableColumnsByName(TeamSearchFields)

// TeamSearchFields are read from the generated IAM manifest, where they are
// declared in apps/iam/kinds/team.cue.
var TeamSearchFields = resource.NewManifestBackedProvider(iamManifests).Fields(
	v0alpha1.TeamResourceInfo.GroupVersionResource(),
)

func GetTeamSearchBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(TeamSearchTableColumnDefinitions))
	for _, v := range TeamSearchTableColumnDefinitions {
		values = append(values, v)
	}
	fields, err := resource.NewSearchableDocumentFields(values)
	if err != nil {
		return resource.DocumentBuilderInfo{}, err
	}

	gvr := v0alpha1.TeamResourceInfo.GroupVersionResource()
	provider := resource.NewMapProvider(
		map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
			gvr: TeamSearchFields,
		},
		map[schema.GroupResource]string{
			gvr.GroupResource(): gvr.Version,
		},
	)

	gr := v0alpha1.TeamResourceInfo.GroupResource()
	return resource.DocumentBuilderInfo{
		GroupResource:        gr,
		Fields:               fields,
		Builder:              resource.StandardDocumentBuilderWithFields(iamManifests, provider),
		SearchFieldsHash:     provider.IndexAffectingHash(gr.Group, gr.Resource),
		SearchFieldsProvider: provider,
	}, nil
}
