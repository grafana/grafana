package sync

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/require"
)

func TestManagedResourceIndex(t *testing.T) {
	index := newManagedResourceIndex(&provisioning.ResourceList{
		Items: []provisioning.ResourceListItem{
			{
				Name:     "parent-uid",
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Path:     "parent",
			},
			{
				Name:     "child-folder-uid",
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Path:     "parent/child",
			},
			{
				Name:     "parent-dash-uid",
				Group:    "dashboards",
				Resource: "dashboards",
				Path:     "parent/dashboard.json",
			},
			{
				Name:     "grandchild-dash-uid",
				Group:    "dashboards",
				Resource: "dashboards",
				Path:     "parent/child/dashboard.json",
			},
		},
	})

	require.NotNil(t, index.ExistingAt("parent/"))
	require.Nil(t, index.ExistingAt("parent"))
	require.Equal(t, []string{
		"parent/child/",
		"parent/dashboard.json",
	}, index.DirectChildrenOf("parent/"))
}
