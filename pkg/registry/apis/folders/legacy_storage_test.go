package folders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestLegacyStorageList(t *testing.T) {
	// Ensure List returns all folders existing in service folder, regardless of
	// whether they are at root level or not

	folderService := &foldertest.FakeService{}
	folderService.ExpectedFolders = []*folder.Folder{
		{UID: "parent", Title: "Folder Parent", ParentUID: ""},
		{UID: "child", Title: "Folder Child", ParentUID: "parent"},
		{UID: "anotherparent1", Title: "Folder Another Parent 1", ParentUID: ""},
		{UID: "anotherparent1", Title: "Folder Another Parent 2", ParentUID: ""},
	}

	usr := &user.SignedInUser{UserID: 1}
	ctx := identity.WithRequester(context.Background(), usr)

	ls := legacyStorage{
		service:    folderService,
		namespacer: func(_ int64) string { return "1" },
	}

	ll, err := ls.List(ctx, &metainternalversion.ListOptions{})
	require.Nil(t, err)
	require.NotNil(t, ll)

	list, err := meta.ExtractList(ll)
	require.Nil(t, err)
	require.NotNil(t, list)
	require.Equal(t, len(list), 4)

	uidsFromServiceFolder := []string{}
	for _, f := range folderService.ExpectedFolders {
		uidsFromServiceFolder = append(uidsFromServiceFolder, f.UID)
	}

	uidsReturnedByList := []string{}
	for _, obj := range list {
		f, ok := obj.(*v0alpha1.Folder)
		require.Equal(t, true, ok)
		uidsReturnedByList = append(uidsReturnedByList, f.ObjectMeta.Name)
	}
	require.ElementsMatch(t, uidsFromServiceFolder, uidsReturnedByList)
}
