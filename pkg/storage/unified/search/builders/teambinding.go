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

// TeamBindingSearchFields declares paths and types for each team binding
// search field. The standard document builder uses these to extract values
// from the raw JSON, avoiding a custom builder.
//
// external sets EmitZeroIfAbsent so the field is always indexed, matching
// the old custom builder which set doc.Fields[external] unconditionally.
// The generated TeamBindingSpec uses json:"external" without omitempty,
// so today the JSON always carries the value; the flag preserves intent
// against a future schema change that adds omitempty.
var TeamBindingSearchFields = []resource.SearchFieldDefinition{
	{Name: TEAM_BINDING_SUBJECT, Path: "spec.subject.name", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
	{Name: TEAM_BINDING_TEAM, Path: "spec.teamRef.name", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
	{Name: TEAM_BINDING_PERMISSION, Path: "spec.permission", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve}},
	{Name: TEAM_BINDING_EXTERNAL, Path: "spec.external", Type: resource.SearchFieldTypeBoolean, Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve}, EmitZeroIfAbsent: true},
}

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
