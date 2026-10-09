package builders

import (
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

const (
	TEAM_BINDING_SUBJECT    = "subject"
	TEAM_BINDING_TEAM       = "team"
	TEAM_BINDING_PERMISSION = "permission"
	TEAM_BINDING_EXTERNAL   = "external"
)

// TeamBindingSearchFields are read from the generated IAM manifest, where they
// are declared in apps/iam/kinds/teambinding.cue.
//
// Exported for the IAM legacy SQL search backend; do not mutate.
var TeamBindingSearchFields = iamProvider.Fields(
	iamv0.TeamBindingResourceInfo.GroupVersionResource(),
)

func GetTeamBindingBuilder(registry *searchmodel.SearchFieldsRegistry) (searchmodel.DocumentBuilderInfo, error) {
	return iamBuilder(registry, iamv0.TeamBindingResourceInfo)
}
