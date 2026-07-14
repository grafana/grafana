package builders

import (
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	TEAM_BINDING_SUBJECT    = "subject"
	TEAM_BINDING_TEAM       = "team"
	TEAM_BINDING_PERMISSION = "permission"
	TEAM_BINDING_EXTERNAL   = "external"
)

// teamBindingSearchFields are read from the generated IAM manifest, where they
// are declared in apps/iam/kinds/teambinding.cue.
var teamBindingSearchFields = resource.NewManifestBackedProvider(iamManifests).Fields(
	iamv0.TeamBindingResourceInfo.GroupVersionResource(),
)

// TeamBindingTableColumnDefinitions exposes column-defs by name for the
// IAM legacy SQL backend in teambinding/legacy_search.go.
var TeamBindingTableColumnDefinitions = tableColumnsByName(teamBindingSearchFields)

func GetTeamBindingBuilder() (resource.DocumentBuilderInfo, error) {
	return iamBuilder(iamv0.TeamBindingResourceInfo, teamBindingSearchFields)
}
