package builders

import (
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	TEAM_SEARCH_EMAIL        = "email"
	TEAM_SEARCH_PROVISIONED  = "provisioned"
	TEAM_SEARCH_EXTERNAL_UID = "externalUID"
	TEAM_SEARCH_MEMBERS      = "members"
	// TEAM_SEARCH_EXTERNAL_GROUPS names the team index column that the
	// enterprise external-group-mapping search reads.
	TEAM_SEARCH_EXTERNAL_GROUPS = "externalGroups"
)

// TeamSortableExtraFields are the additional fields that can be used for sorting team search results.
// Should not include standard fields like title.
var TeamSortableExtraFields = []string{
	TEAM_SEARCH_EMAIL,
}

// teamSearchFields are read from the generated IAM manifest, where they are
// declared in apps/iam/kinds/team.cue.
var teamSearchFields = resource.NewManifestBackedProvider(iamManifests).Fields(
	v0alpha1.TeamResourceInfo.GroupVersionResource(),
)

// TeamSearchTableColumnDefinitions exposes column-defs by name for the
// IAM legacy SQL backend in team/legacy_search.go.
var TeamSearchTableColumnDefinitions = tableColumnsByName(teamSearchFields)

func GetTeamSearchBuilder() (resource.DocumentBuilderInfo, error) {
	return iamBuilder(v0alpha1.TeamResourceInfo, teamSearchFields)
}
