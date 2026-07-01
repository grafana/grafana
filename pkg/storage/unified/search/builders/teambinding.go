package builders

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	TEAM_BINDING_SUBJECT    = "subject"
	TEAM_BINDING_TEAM       = "team"
	TEAM_BINDING_PERMISSION = "permission"
	TEAM_BINDING_EXTERNAL   = "external"
)

// TeamBindingTableColumnDefinitions exposes column-defs by name for the
// IAM legacy SQL backend in teambinding/legacy_search.go.
var TeamBindingTableColumnDefinitions = tableColumnsByName(TeamBindingSearchFields)

// TeamBindingSearchFields are read from the generated IAM manifest, where they
// are declared in apps/iam/kinds/teambinding.cue.
var TeamBindingSearchFields = resource.NewManifestBackedProvider(iamManifests).Fields(
	iamv0.TeamBindingResourceInfo.GroupVersionResource(),
)

func GetTeamBindingBuilder() (resource.DocumentBuilderInfo, error) {
	values := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(TeamBindingTableColumnDefinitions))
	for _, v := range TeamBindingTableColumnDefinitions {
		values = append(values, v)
	}
	fields, err := resource.NewSearchableDocumentFields(values)
	if err != nil {
		return resource.DocumentBuilderInfo{}, err
	}

	gvr := iamv0.TeamBindingResourceInfo.GroupVersionResource()
	provider := resource.NewMapProvider(
		map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
			gvr: TeamBindingSearchFields,
		},
		map[schema.GroupResource]string{
			gvr.GroupResource(): gvr.Version,
		},
	)

	gr := iamv0.TeamBindingResourceInfo.GroupResource()
	return resource.DocumentBuilderInfo{
		GroupResource:        gr,
		Fields:               fields,
		Builder:              resource.StandardDocumentBuilderWithFields(iamManifests, provider),
		SearchFieldsHash:     provider.IndexAffectingHash(gr.Group, gr.Resource),
		SearchFieldsProvider: provider,
	}, nil
}
