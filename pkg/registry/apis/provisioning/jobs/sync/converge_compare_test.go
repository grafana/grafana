package sync

import (
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/plan"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// The plan keys a folder with a trailing slash and the resource list does not
// always carry one. When the two disagree, every folder relocation loses the
// row holding its old path and is mistaken for a fresh create — which is how
// seven folder-move tests went red.
func TestFolderIndexKeyAgreesWithTheObservedKey(t *testing.T) {
	for _, path := range []string{"team/", "team", "team/sub", "team/sub/"} {
		item := provisioning.ResourceListItem{
			Path:     path,
			Name:     "F1",
			Group:    resources.FolderResource.Group,
			Resource: resources.FolderResource.Resource,
		}
		observed, _ := plan.Observe(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{item}})
		require.Len(t, observed, 1)

		require.Equal(t,
			string(observed[0].Key),
			indexKey(item.Path, isFolderItem(&item)),
			"the index and the plan must key folder %q the same way", path)
	}
}

func TestEntityIndexKeyIsThePathAsGiven(t *testing.T) {
	item := provisioning.ResourceListItem{
		Path: "team/one.json", Name: "D1",
		Group: "dashboard.grafana.app", Resource: "dashboards",
	}
	observed, _ := plan.Observe(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{item}})
	require.Len(t, observed, 1)
	require.Equal(t, string(observed[0].Key), indexKey(item.Path, isFolderItem(&item)))
	require.False(t, converge.Key(item.Path).IsContainer())
}
