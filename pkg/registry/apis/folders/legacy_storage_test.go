package folders

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/labels"

	"encoding/base64"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
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
		f, ok := obj.(*folderv1.Folder)
		require.Equal(t, true, ok)
		uidsReturnedByList = append(uidsReturnedByList, f.Name)
	}
	require.ElementsMatch(t, uidsFromServiceFolder, uidsReturnedByList)
}

func TestLegacyStorage_List_Pagination(t *testing.T) {
	usr := &user.SignedInUser{UserID: 1}
	ctx := identity.WithRequester(context.Background(), usr)
	folderService := &foldertest.FakeService{}
	storage := legacyStorage{
		service:    folderService,
		namespacer: func(_ int64) string { return "1" },
	}

	t.Run("should set correct continue token", func(t *testing.T) {
		options := &metainternalversion.ListOptions{
			Limit: 2,
		}
		folders := make([]*folder.Folder, 2)
		for i := range folders {
			folders[i] = &folder.Folder{
				UID:   fmt.Sprintf("folder-%d", i),
				Title: fmt.Sprintf("Folder %d", i),
			}
		}
		folderService.ExpectedFolders = folders

		result, err := storage.List(ctx, options)
		require.NoError(t, err)

		list, ok := result.(*folderv1.FolderList)
		require.True(t, ok)
		token, err := base64.StdEncoding.DecodeString(list.Continue)
		require.NoError(t, err)
		require.Equal(t, "2|2", string(token))
		require.Equal(t, folderService.LastQuery.Limit, int64(2))
		require.Equal(t, folderService.LastQuery.Page, int64(1))
	})

	t.Run("should set page to 1 when limit is set without continue token", func(t *testing.T) {
		options := &metainternalversion.ListOptions{
			Limit: 2,
		}
		folders := make([]*folder.Folder, 2)
		for i := range folders {
			folders[i] = &folder.Folder{
				UID:   fmt.Sprintf("folder-%d", i),
				Title: fmt.Sprintf("Folder %d", i),
			}
		}
		folderService.ExpectedFolders = folders

		result, err := storage.List(ctx, options)
		require.NoError(t, err)
		list, ok := result.(*folderv1.FolderList)
		require.True(t, ok)
		token, err := base64.StdEncoding.DecodeString(list.Continue)
		require.NoError(t, err)
		require.Equal(t, "2|2", string(token))
		require.Equal(t, int64(2), folderService.LastQuery.Limit)
		require.Equal(t, int64(1), folderService.LastQuery.Page)
	})

	t.Run("should set page limit to default when no limit is specified in options", func(t *testing.T) {
		options := &metainternalversion.ListOptions{}
		folders := make([]*folder.Folder, defaultPageLimit)
		for i := range folders {
			folders[i] = &folder.Folder{
				UID:   fmt.Sprintf("folder-%d", i),
				Title: fmt.Sprintf("Folder %d", i),
			}
		}
		folderService.ExpectedFolders = folders

		result, err := storage.List(ctx, options)
		require.NoError(t, err)

		// assert we return the default page limit for the first page
		list, ok := result.(*folderv1.FolderList)
		require.True(t, ok)

		// assert returned continue token is correct and previous paging was correct
		token, err := base64.StdEncoding.DecodeString(list.Continue)
		require.NoError(t, err)
		require.Equal(t, "100|2", string(token))
		require.Equal(t, int64(defaultPageLimit), folderService.LastQuery.Limit)
		require.Equal(t, int64(1), folderService.LastQuery.Page)
	})
}

func TestLegacyStorage_List_LabelSelector(t *testing.T) {
	usr := &user.SignedInUser{UserID: 1, OrgRole: org.RoleAdmin}
	ctx := identity.WithRequester(context.Background(), usr)
	folderService := &foldertest.FakeService{}
	storage := legacyStorage{
		service:    folderService,
		namespacer: func(_ int64) string { return "1" },
	}

	t.Run("should handle nil label selector", func(t *testing.T) {
		options := &metainternalversion.ListOptions{
			LabelSelector: nil,
		}

		folders := []*folder.Folder{
			{
				UID:   "folder-1",
				Title: "Folder 1",
			},
		}
		folderService.ExpectedFolders = folders

		result, err := storage.List(ctx, options)
		require.NoError(t, err)

		// verify we queried the service correctly
		require.False(t, folderService.LastQuery.WithFullpath)
		require.False(t, folderService.LastQuery.WithFullpathUIDs)

		list, ok := result.(*folderv1.FolderList)
		require.True(t, ok)
		require.Len(t, list.Items, 1)
	})

	t.Run("should set fullpath query parameters when label selector matches", func(t *testing.T) {
		selector, err := labels.Parse(utils.LabelGetFullpath + "=true")
		require.NoError(t, err)
		options := &metainternalversion.ListOptions{
			LabelSelector: selector,
		}

		folders := []*folder.Folder{
			{
				UID:          "folder-1",
				Title:        "Folder 1",
				Fullpath:     "/Folder 1",
				FullpathUIDs: "/folder-1",
			},
		}
		folderService.ExpectedFolders = folders

		result, err := storage.List(ctx, options)
		require.NoError(t, err)

		// verify we queried the service correctly
		require.True(t, folderService.LastQuery.WithFullpath)
		require.True(t, folderService.LastQuery.WithFullpathUIDs)

		list, ok := result.(*folderv1.FolderList)
		require.True(t, ok)
		require.Len(t, list.Items, 1)

		folder := list.Items[0]
		meta, err := utils.MetaAccessor(&folder)
		require.NoError(t, err)

		// make sure the annotations are set
		require.Equal(t, "/Folder 1", meta.GetFullpath())
		require.Equal(t, "/folder-1", meta.GetFullpathUIDs())
	})
}
