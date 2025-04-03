package folderimpl

import (
	"context"
	"fmt"
	"path"
	"slices"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var folderTitle string = "folder1"
var folderDsc string = "folder desc"

func TestIntegrationCreate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)

	orgID := CreateOrg(t, db, cfg)

	t.Run("creating a folder without providing a UID should fail", func(t *testing.T) {
		_, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       folderTitle,
			Description: folderDsc,
			OrgID:       orgID,
		})
		require.Error(t, err)
	})

	t.Run("creating a folder with unknown parent should fail", func(t *testing.T) {
		_, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       folderTitle,
			OrgID:       orgID,
			ParentUID:   "unknown",
			Description: folderDsc,
			UID:         util.GenerateShortUID(),
		})
		require.Error(t, err)
	})

	t.Run("creating a folder with itself as a parent should fail", func(t *testing.T) {
		uid := util.GenerateShortUID()
		_, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       folderTitle,
			OrgID:       orgID,
			ParentUID:   uid,
			Description: folderDsc,
			UID:         uid,
		})
		require.ErrorIs(t, err, folder.ErrFolderCannotBeParentOfItself)
	})

	t.Run("creating a folder without providing a parent should default to the empty parent folder", func(t *testing.T) {
		uid := util.GenerateShortUID()
		f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       folderTitle,
			Description: folderDsc,
			OrgID:       orgID,
			UID:         uid,
		})
		require.NoError(t, err)

		t.Cleanup(func() {
			err := folderStore.Delete(context.Background(), []string{f.UID}, orgID)
			require.NoError(t, err)
		})

		assert.Equal(t, folderTitle, f.Title)
		assert.Equal(t, folderDsc, f.Description)
		assert.NotEmpty(t, f.UID)
		assert.Equal(t, uid, f.UID)
		assert.Empty(t, f.ParentUID)
		assert.NotEmpty(t, f.URL)

		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &f.UID,
			OrgID: orgID,
		})
		assert.NoError(t, err)
		assert.Equal(t, folderTitle, ff.Title)
		assert.Equal(t, folderDsc, ff.Description)
		assert.Empty(t, ff.ParentUID)
		assert.NotEmpty(t, ff.URL)

		assertAncestorUIDs(t, folderStore, f, []string{folder.GeneralFolderUID})
	})

	t.Run("creating a folder with a known parent should succeed", func(t *testing.T) {
		parentUID := util.GenerateShortUID()
		parent, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title: "parent",
			OrgID: orgID,
			UID:   parentUID,
		})
		require.NoError(t, err)
		require.Equal(t, "parent", parent.Title)
		require.NotEmpty(t, parent.UID)
		assert.Equal(t, parentUID, parent.UID)
		assert.NotEmpty(t, parent.URL)

		t.Cleanup(func() {
			err := folderStore.Delete(context.Background(), []string{parent.UID}, orgID)
			require.NoError(t, err)
		})
		assertAncestorUIDs(t, folderStore, parent, []string{folder.GeneralFolderUID})

		uid := util.GenerateShortUID()
		f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       folderTitle,
			OrgID:       orgID,
			ParentUID:   parent.UID,
			Description: folderDsc,
			UID:         uid,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			err := folderStore.Delete(context.Background(), []string{f.UID}, orgID)
			require.NoError(t, err)
		})

		assert.Equal(t, folderTitle, f.Title)
		assert.Equal(t, folderDsc, f.Description)
		assert.NotEmpty(t, f.UID)
		assert.Equal(t, uid, f.UID)
		assert.Equal(t, parentUID, f.ParentUID)
		assert.NotEmpty(t, f.URL)

		assertAncestorUIDs(t, folderStore, f, []string{folder.GeneralFolderUID, parent.UID})
		assertChildrenUIDs(t, folderStore, parent, []string{f.UID})

		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &f.UID,
			OrgID: f.OrgID,
		})
		assert.NoError(t, err)
		assert.Equal(t, folderTitle, ff.Title)
		assert.Equal(t, folderDsc, ff.Description)
		assert.Equal(t, parentUID, ff.ParentUID)
		assert.NotEmpty(t, ff.URL)
	})
}

func TestIntegrationDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)

	orgID := CreateOrg(t, db, cfg)

	/*
		t.Run("attempt to delete unknown folder should fail", func(t *testing.T) {
			err := folderSrore.Delete(context.Background(), "unknown", orgID)
			assert.Error(t, err)
		})
	*/

	ancestorUIDs := CreateSubtree(t, folderStore, orgID, "", folder.MaxNestedFolderDepth, "")
	require.Len(t, ancestorUIDs, folder.MaxNestedFolderDepth)

	t.Cleanup(func() {
		for _, uid := range ancestorUIDs[1:] {
			err := folderStore.Delete(context.Background(), []string{uid}, orgID)
			require.NoError(t, err)
		}
	})

	/*
		t.Run("deleting folder with children should fail", func(t *testing.T) {
			err = folderSrore.Delete(context.Background(), ancestorUIDs[2], orgID)
			require.Error(t, err)
		})
	*/

	t.Run("deleting a leaf folder should succeed", func(t *testing.T) {
		err := folderStore.Delete(context.Background(), []string{ancestorUIDs[len(ancestorUIDs)-1]}, orgID)
		require.NoError(t, err)

		children, err := folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			UID:   ancestorUIDs[len(ancestorUIDs)-2],
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Len(t, children, 0)
	})
}

func TestIntegrationUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)

	orgID := CreateOrg(t, db, cfg)

	// create parent folder
	parent, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         util.GenerateShortUID(),
	})
	require.NoError(t, err)

	// create subfolder
	f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         util.GenerateShortUID(),
		ParentUID:   parent.UID,
	})

	require.NoError(t, err)
	require.Equal(t, f.ParentUID, parent.UID)
	t.Cleanup(func() {
		err := folderStore.Delete(context.Background(), []string{f.UID}, orgID)
		require.NoError(t, err)
	})

	/*
		t.Run("updating an unknown folder should fail", func(t *testing.T) {
			newTitle := "new title"
			newDesc := "new desc"
			_, err := folderSrore.Update(context.Background(), &folder.UpdateFolderCommand{
				Folder:         f,
				NewTitle:       &newTitle,
				NewDescription: &newDesc,
			})
			require.NoError(t, err)

			ff, err := folderSrore.Get(context.Background(), &folder.GetFolderQuery{
				UID: &f.UID,
			})
			require.NoError(t, err)

			assert.Equal(t, origTitle, ff.Title)
			assert.Equal(t, origDesc, ff.Description)
		})
	*/

	t.Run("should not panic in case of bad requests", func(t *testing.T) {
		_, err = folderStore.Update(context.Background(), folder.UpdateFolderCommand{})
		require.Error(t, err)

		_, err = folderStore.Update(context.Background(), folder.UpdateFolderCommand{})
		require.Error(t, err)
	})

	t.Run("updating a folder should succeed", func(t *testing.T) {
		newTitle := "new title"
		newDesc := "new desc"
		// existingUpdated := f.Updated
		updated, err := folderStore.Update(context.Background(), folder.UpdateFolderCommand{
			UID:            f.UID,
			OrgID:          f.OrgID,
			NewTitle:       &newTitle,
			NewDescription: &newDesc,
		})
		require.NoError(t, err)

		assert.Equal(t, f.UID, updated.UID)
		assert.Equal(t, newTitle, updated.Title)
		assert.Equal(t, newDesc, updated.Description)
		assert.Equal(t, parent.UID, updated.ParentUID)
		assert.NotEmpty(t, updated.URL)
		// assert.GreaterOrEqual(t, updated.Updated.UnixNano(), existingUpdated.UnixNano())

		updated, err = folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &updated.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, newTitle, updated.Title)
		assert.Equal(t, newDesc, updated.Description)
		// parent should not change
		assert.Equal(t, parent.UID, updated.ParentUID)
		assert.NotEmpty(t, updated.URL)

		f = updated
	})

	t.Run("updating folder parent UID", func(t *testing.T) {
		testCases := []struct {
			desc                  string
			reqNewParentUID       *string
			expectedError         error
			expectedParentUIDFunc func(existing string) string
		}{
			{
				desc:                  "should succeed when moving to other folder",
				reqNewParentUID:       util.Pointer("new"),
				expectedParentUIDFunc: func(_ string) string { return "new" },
			},
			{
				desc:                  "should succeed when moving to root folder (NewParentUID is empty)",
				reqNewParentUID:       util.Pointer(""),
				expectedParentUIDFunc: func(_ string) string { return "" },
			},
			{
				desc:                  "should do nothing when NewParentUID is nil",
				reqNewParentUID:       nil,
				expectedError:         folder.ErrBadRequest,
				expectedParentUIDFunc: func(existingParentUID string) string { return existingParentUID },
			},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				// create parent folder
				parentUID := util.GenerateShortUID()
				_, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
					Title:       "parent",
					Description: "parent",
					OrgID:       orgID,
					UID:         parentUID,
				})
				require.NoError(t, err)

				// create subfolder
				UID := util.GenerateShortUID()
				f, err = folderStore.Create(context.Background(), folder.CreateFolderCommand{
					Title:       "subfolder",
					Description: "subfolder",
					OrgID:       orgID,
					UID:         UID,
					ParentUID:   parentUID,
				})
				require.NoError(t, err)

				existingTitle := f.Title
				existingDesc := f.Description
				existingUID := f.UID
				updated, err := folderStore.Update(context.Background(), folder.UpdateFolderCommand{
					UID:          f.UID,
					OrgID:        f.OrgID,
					NewParentUID: tc.reqNewParentUID,
				})
				if tc.expectedError == nil {
					require.NoError(t, err)
					assert.Equal(t, tc.expectedParentUIDFunc(parentUID), updated.ParentUID)
				} else {
					assert.ErrorIs(t, err, tc.expectedError)
				}

				updated, err = folderStore.Get(context.Background(), folder.GetFolderQuery{
					UID:   &f.UID,
					OrgID: orgID,
				})
				require.NoError(t, err)
				assert.Equal(t, tc.expectedParentUIDFunc(parentUID), updated.ParentUID)
				assert.Equal(t, existingTitle, updated.Title)
				assert.Equal(t, existingDesc, updated.Description)
				assert.Equal(t, existingUID, updated.UID)
				assert.NotEmpty(t, updated.URL)
			})
		}
	})
}

func TestIntegrationGet(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)

	orgID := CreateOrg(t, db, cfg)

	// create folder
	uid1 := util.GenerateShortUID()
	f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         uid1,
	})
	require.NoError(t, err)
	subfolderWithSameName, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         util.GenerateShortUID(),
		ParentUID:   f.UID,
	})
	require.NoError(t, err)

	t.Run("should gently fail in case of bad request", func(t *testing.T) {
		_, err = folderStore.Get(context.Background(), folder.GetFolderQuery{})
		require.Error(t, err)
	})

	t.Run("get folder by UID should succeed", func(t *testing.T) {
		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &f.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		//assert.Equal(t, folder.GeneralFolderUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder by title should succeed", func(t *testing.T) {
		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			Title: &f.Title,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		//assert.Equal(t, folder.GeneralFolderUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder by title and parent UID should succeed", func(t *testing.T) {
		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			Title:     &f.Title,
			OrgID:     orgID,
			ParentUID: &uid1,
		})
		require.NoError(t, err)
		assert.Equal(t, subfolderWithSameName.UID, ff.UID)
		assert.Equal(t, subfolderWithSameName.OrgID, ff.OrgID)
		assert.Equal(t, subfolderWithSameName.Title, ff.Title)
		assert.Equal(t, subfolderWithSameName.Description, ff.Description)
		assert.Equal(t, subfolderWithSameName.ParentUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder by title should succeed", func(t *testing.T) {
		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &f.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		//assert.Equal(t, folder.GeneralFolderUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder with fullpath should set fullpath as expected", func(t *testing.T) {
		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:          &subfolderWithSameName.UID,
			OrgID:        orgID,
			WithFullpath: true,
		})
		require.NoError(t, err)
		assert.Equal(t, subfolderWithSameName.UID, ff.UID)
		assert.Equal(t, subfolderWithSameName.OrgID, ff.OrgID)
		assert.Equal(t, subfolderWithSameName.Title, ff.Title)
		assert.Equal(t, subfolderWithSameName.Description, ff.Description)
		assert.Equal(t, path.Join(f.Title, subfolderWithSameName.Title), ff.Fullpath)
		assert.Equal(t, f.UID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})

	t.Run("get folder withFullpathUIDs should set fullpathUIDs as expected", func(t *testing.T) {
		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:              &subfolderWithSameName.UID,
			OrgID:            orgID,
			WithFullpathUIDs: true,
		})
		require.NoError(t, err)
		assert.Equal(t, subfolderWithSameName.UID, ff.UID)
		assert.Equal(t, subfolderWithSameName.OrgID, ff.OrgID)
		assert.Equal(t, subfolderWithSameName.Title, ff.Title)
		assert.Equal(t, subfolderWithSameName.Description, ff.Description)
		assert.Equal(t, path.Join(f.UID, subfolderWithSameName.UID), ff.FullpathUIDs)
		assert.Equal(t, f.UID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
		assert.NotEmpty(t, ff.URL)
	})
}

func TestIntegrationGetParents(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)

	orgID := CreateOrg(t, db, cfg)

	// create folder
	uid1 := util.GenerateShortUID()
	f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         uid1,
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		err := folderStore.Delete(context.Background(), []string{f.UID}, orgID)
		require.NoError(t, err)
	})

	t.Run("get parents of root folder should be empty", func(t *testing.T) {
		parents, err := folderStore.GetParents(context.Background(), folder.GetParentsQuery{})
		require.NoError(t, err)
		require.Empty(t, parents)
	})

	t.Run("get parents of 1-st level folder should be empty", func(t *testing.T) {
		parents, err := folderStore.GetParents(context.Background(), folder.GetParentsQuery{
			UID:   f.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		require.Empty(t, parents)
	})

	t.Run("get parents of 2-st level folder should not be empty", func(t *testing.T) {
		title2 := "folder2"
		desc2 := "folder2 desc"
		uid2 := util.GenerateShortUID()

		f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       title2,
			Description: desc2,
			OrgID:       orgID,
			UID:         uid2,
			ParentUID:   f.UID,
		})
		require.NoError(t, err)

		parents, err := folderStore.GetParents(context.Background(), folder.GetParentsQuery{
			UID:   f.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		parentUIDs := make([]string, 0)
		for _, p := range parents {
			assert.NotEmpty(t, p.URL)
			parentUIDs = append(parentUIDs, p.UID)
		}
		require.Equal(t, []string{uid1}, parentUIDs)
	})
}

func TestIntegrationGetChildren(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)

	orgID := CreateOrg(t, db, cfg)

	// create folder
	uid1 := util.GenerateShortUID()
	parent, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         uid1,
	})
	require.NoError(t, err)

	treeLeaves := CreateLeaves(t, folderStore, parent, 8)
	sort.Strings(treeLeaves)

	t.Cleanup(func() {
		for _, uid := range treeLeaves {
			err := folderStore.Delete(context.Background(), []string{uid}, orgID)
			require.NoError(t, err)
		}
	})

	/*
		t.Run("should gently fail in case of bad request", func(t *testing.T) {
			_, err := folderStore.GetChildren(context.Background(), folder.GetTreeQuery{})
			require.Error(t, err)
		})
	*/

	t.Run("should successfully get all children", func(t *testing.T) {
		children, err := folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			UID:   parent.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)

		childrenUIDs := make([]string, 0, len(children))
		for _, c := range children {
			childrenUIDs = append(childrenUIDs, c.UID)
		}

		if diff := cmp.Diff(treeLeaves, childrenUIDs); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("should default to general folder if UID is missing", func(t *testing.T) {
		children, err := folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			OrgID: orgID,
		})
		require.NoError(t, err)

		childrenUIDs := make([]string, 0, len(children))
		for _, c := range children {
			childrenUIDs = append(childrenUIDs, c.UID)
		}
		assert.Equal(t, []string{parent.UID}, childrenUIDs)
	})

	t.Run("query with pagination should work as expected", func(t *testing.T) {
		children, err := folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			UID:   parent.UID,
			OrgID: orgID,
			Limit: 2,
		})
		require.NoError(t, err)

		childrenUIDs := make([]string, 0, len(children))
		for _, c := range children {
			childrenUIDs = append(childrenUIDs, c.UID)
		}

		if diff := cmp.Diff(treeLeaves[:2], childrenUIDs); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		children, err = folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			UID:   parent.UID,
			OrgID: orgID,
			Limit: 2,
			Page:  1,
		})
		require.NoError(t, err)

		childrenUIDs = make([]string, 0, len(children))
		for _, c := range children {
			childrenUIDs = append(childrenUIDs, c.UID)
		}

		if diff := cmp.Diff(treeLeaves[:2], childrenUIDs); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		children, err = folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			UID:   parent.UID,
			OrgID: orgID,
			Limit: 2,
			Page:  2,
		})
		require.NoError(t, err)

		childrenUIDs = make([]string, 0, len(children))
		for _, c := range children {
			childrenUIDs = append(childrenUIDs, c.UID)
		}

		if diff := cmp.Diff(treeLeaves[2:4], childrenUIDs); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		// fetch folder with specific UIDs and pagination
		children, err = folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			UID:        parent.UID,
			OrgID:      orgID,
			Limit:      2,
			Page:       1,
			FolderUIDs: treeLeaves[3:4],
		})
		require.NoError(t, err)

		childrenUIDs = make([]string, 0, len(children))
		for _, c := range children {
			childrenUIDs = append(childrenUIDs, c.UID)
		}

		if diff := cmp.Diff(treeLeaves[3:4], childrenUIDs); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		// no page is set
		children, err = folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			UID:   parent.UID,
			OrgID: orgID,
			Limit: 1,
		})
		require.NoError(t, err)

		childrenUIDs = make([]string, 0, len(children))
		for _, c := range children {
			childrenUIDs = append(childrenUIDs, c.UID)
		}

		if diff := cmp.Diff(treeLeaves[:1], childrenUIDs); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}

		// page is set but limit is not set, it should return them all
		children, err = folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			UID:   parent.UID,
			OrgID: orgID,
			Page:  1,
		})
		require.NoError(t, err)

		childrenUIDs = make([]string, 0, len(children))
		for _, c := range children {
			childrenUIDs = append(childrenUIDs, c.UID)
		}

		if diff := cmp.Diff(treeLeaves, childrenUIDs); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("should hide k6-app folder for users but not for service accounts", func(t *testing.T) {
		_, err = folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title: "k6-app-folder",
			OrgID: orgID,
			UID:   accesscontrol.K6FolderUID,
		})
		require.NoError(t, err)

		children, err := folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			OrgID:        orgID,
			SignedInUser: usr,
		})
		require.NoError(t, err)
		require.Equal(t, 1, len(children))
		assert.Equal(t, parent.UID, children[0].UID)

		// Service account should be able to list k6 folder
		children, err = folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			OrgID:        orgID,
			SignedInUser: &user.SignedInUser{UserID: 2, OrgID: orgID, IsServiceAccount: true},
		})
		require.NoError(t, err)
		require.Equal(t, 2, len(children))
		childrenUIDs := make([]string, 0, len(children))
		for _, child := range children {
			childrenUIDs = append(childrenUIDs, child.UID)
		}
		assert.EqualValues(t, []string{parent.UID, accesscontrol.K6FolderUID}, childrenUIDs)
	})

	t.Run("pagination works if k6-app folder is hidden", func(t *testing.T) {
		for i := 0; i < 4; i++ {
			_, err = folderStore.Create(context.Background(), folder.CreateFolderCommand{
				Title: fmt.Sprintf("root-%d", i),
				OrgID: orgID,
				UID:   fmt.Sprintf("root-%d", i),
			})
			require.NoError(t, err)
		}

		// Should skip k6-app folder but get parent folder and two more folders
		children, err := folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			OrgID:        orgID,
			SignedInUser: usr,
			Limit:        3,
		})
		require.NoError(t, err)
		require.Equal(t, 3, len(children))
		assert.EqualValues(t, []string{parent.UID, "root-0", "root-1"}, []string{children[0].UID, children[1].UID, children[2].UID})

		// Should get the two remaining folders
		children, err = folderStore.GetChildren(context.Background(), folder.GetChildrenQuery{
			OrgID:        orgID,
			SignedInUser: usr,
			Page:         2,
			Limit:        3,
		})
		require.NoError(t, err)
		require.Equal(t, 2, len(children))
		assert.EqualValues(t, []string{"root-2", "root-3"}, []string{children[0].UID, children[1].UID})
	})
}

func TestIntegrationGetHeight(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)

	orgID := CreateOrg(t, db, cfg)

	// create folder
	uid1 := util.GenerateShortUID()
	parent, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       folderTitle,
		Description: folderDsc,
		OrgID:       orgID,
		UID:         uid1,
	})
	require.NoError(t, err)
	subTree := CreateSubtree(t, folderStore, orgID, parent.UID, 4, "sub")
	t.Run("should successfully get height", func(t *testing.T) {
		height, err := folderStore.GetHeight(context.Background(), parent.UID, orgID, nil)
		require.NoError(t, err)
		require.Equal(t, 4, height)
	})

	t.Run("should failed when the parent folder exist in the subtree", func(t *testing.T) {
		_, err = folderStore.GetHeight(context.Background(), parent.UID, orgID, &subTree[0])
		require.Error(t, err, folder.ErrCircularReference)
	})
}

func TestIntegrationGetFolders(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	foldersNum := 10
	db, cfg := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db)

	orgID := CreateOrg(t, db, cfg)

	// create folders
	uids := make([]string, 0)
	folders := make([]*folder.Folder, 0)
	for i := 0; i < foldersNum; i++ {
		uid := util.GenerateShortUID()
		f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       folderTitle + fmt.Sprintf("-%d", i),
			Description: folderDsc,
			OrgID:       orgID,
			UID:         uid,
		})
		require.NoError(t, err)

		uids = append(uids, uid)
		folders = append(folders, f)
	}

	t.Cleanup(func() {
		for _, uid := range uids {
			err := folderStore.Delete(context.Background(), []string{uid}, orgID)
			require.NoError(t, err)
		}
	})

	t.Run("get folders by UIDs should succeed", func(t *testing.T) {
		actualFolders, err := folderStore.GetFolders(context.Background(), folder.NewGetFoldersQuery(folder.GetFoldersQuery{OrgID: orgID, UIDs: uids[1:]}))
		require.NoError(t, err)
		assert.Equal(t, len(uids[1:]), len(actualFolders))
		for _, f := range folders[1:] {
			folderInResponseIdx := slices.IndexFunc(actualFolders, func(rf *folder.Folder) bool {
				return rf.UID == f.UID
			})
			assert.NotEqual(t, -1, folderInResponseIdx)
			actualFolder := actualFolders[folderInResponseIdx]
			assert.Equal(t, f.UID, actualFolder.UID)
			assert.Equal(t, f.OrgID, actualFolder.OrgID)
			assert.Equal(t, f.Title, actualFolder.Title)
			assert.Equal(t, f.Description, actualFolder.Description)
			assert.NotEmpty(t, actualFolder.Created)
			assert.NotEmpty(t, actualFolder.Updated)
			assert.NotEmpty(t, actualFolder.URL)
		}
	})

	t.Run("get folders by UIDs batching should work as expected", func(t *testing.T) {
		q := folder.NewGetFoldersQuery(folder.GetFoldersQuery{OrgID: orgID, UIDs: uids[1:], BatchSize: 3})
		actualFolders, err := folderStore.GetFolders(context.Background(), q)
		require.NoError(t, err)
		assert.Equal(t, len(uids[1:]), len(actualFolders))
		for _, f := range folders[1:] {
			folderInResponseIdx := slices.IndexFunc(actualFolders, func(rf *folder.Folder) bool {
				return rf.UID == f.UID
			})
			assert.NotEqual(t, -1, folderInResponseIdx)
			actualFolder := actualFolders[folderInResponseIdx]
			assert.Equal(t, f.UID, actualFolder.UID)
			assert.Equal(t, f.OrgID, actualFolder.OrgID)
			assert.Equal(t, f.Title, actualFolder.Title)
			assert.Equal(t, f.Description, actualFolder.Description)
			assert.NotEmpty(t, actualFolder.Created)
			assert.NotEmpty(t, actualFolder.Updated)
			assert.NotEmpty(t, actualFolder.URL)
		}
	})

	t.Run("get folders by UIDs with fullpath should succeed", func(t *testing.T) {
		q := folder.NewGetFoldersQuery(folder.GetFoldersQuery{OrgID: orgID, UIDs: uids[1:], WithFullpath: true})
		q.BatchSize = 3
		actualFolders, err := folderStore.GetFolders(context.Background(), q)
		require.NoError(t, err)
		assert.Equal(t, len(uids[1:]), len(actualFolders))
		for _, f := range folders[1:] {
			folderInResponseIdx := slices.IndexFunc(actualFolders, func(rf *folder.Folder) bool {
				return rf.UID == f.UID
			})
			assert.NotEqual(t, -1, folderInResponseIdx)
			actualFolder := actualFolders[folderInResponseIdx]
			assert.Equal(t, f.UID, actualFolder.UID)
			assert.Equal(t, f.OrgID, actualFolder.OrgID)
			assert.Equal(t, f.Title, actualFolder.Title)
			assert.Equal(t, f.Description, actualFolder.Description)
			assert.NotEmpty(t, actualFolder.Created)
			assert.NotEmpty(t, actualFolder.Updated)
			assert.NotEmpty(t, actualFolder.URL)
			assert.NotEmpty(t, actualFolder.Fullpath)
		}
	})

	t.Run("get folders by UIDs and ancestor UIDs should work as expected", func(t *testing.T) {
		q := folder.NewGetFoldersQuery(folder.GetFoldersQuery{OrgID: orgID, UIDs: uids[1:], BatchSize: 3})
		q.AncestorUIDs = make([]string, 0, int(q.BatchSize)+1)
		for i := 0; i < int(q.BatchSize); i++ {
			q.AncestorUIDs = append(q.AncestorUIDs, uuid.New().String())
		}
		q.AncestorUIDs = append(q.AncestorUIDs, folders[len(folders)-1].UID)

		actualFolders, err := folderStore.GetFolders(context.Background(), q)
		require.NoError(t, err)
		assert.Equal(t, 1, len(actualFolders))

		f := folders[len(folders)-1]
		actualFolder := actualFolders[0]
		assert.Equal(t, f.UID, actualFolder.UID)
		assert.Equal(t, f.OrgID, actualFolder.OrgID)
		assert.Equal(t, f.Title, actualFolder.Title)
		assert.Equal(t, f.Description, actualFolder.Description)
		assert.NotEmpty(t, actualFolder.Created)
		assert.NotEmpty(t, actualFolder.Updated)
		assert.NotEmpty(t, actualFolder.URL)
	})

	t.Run("get folders with limit and page should work as expected", func(t *testing.T) {
		q := folder.NewGetFoldersQuery(folder.GetFoldersQuery{
			OrgID: orgID,
			UIDs:  uids,
			Limit: 3,
			Page:  2,
		})

		actualFolders, err := folderStore.GetFolders(context.Background(), q)
		require.NoError(t, err)
		assert.Equal(t, 3, len(actualFolders))

		for i, actualFolder := range actualFolders {
			assert.Equal(t, fmt.Sprintf("folder1-%d", i+3), actualFolder.Title)
		}
	})
}

func CreateOrg(t *testing.T, db db.DB, cfg *setting.Cfg) int64 {
	t.Helper()

	orgService, err := orgimpl.ProvideService(db, cfg, quotatest.New(false, nil))
	require.NoError(t, err)
	dashSvc := &dashboards.FakeDashboardService{}
	dashSvc.On("DeleteAllDashboards", mock.Anything, mock.Anything).Return(nil)
	deleteOrgService, err := orgimpl.ProvideDeletionService(db, cfg, dashSvc)
	require.NoError(t, err)
	orgID, err := orgService.GetOrCreate(context.Background(), "test-org")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = deleteOrgService.Delete(context.Background(), &org.DeleteOrgCommand{ID: orgID})
		require.NoError(t, err)
	})

	return orgID
}

func CreateSubtree(t *testing.T, store *FolderStoreImpl, orgID int64, parentUID string, depth int, prefix string) []string {
	t.Helper()

	ancestorUIDs := []string{}
	if parentUID != "" {
		ancestorUIDs = append(ancestorUIDs, parentUID)
	}
	for i := 0; i < depth; i++ {
		title := fmt.Sprintf("%sfolder-%d", prefix, i)
		cmd := folder.CreateFolderCommand{
			Title:     title,
			OrgID:     orgID,
			ParentUID: parentUID,
			UID:       util.GenerateShortUID(),
		}
		f, err := store.Create(context.Background(), cmd)
		require.NoError(t, err)
		require.Equal(t, title, f.Title)
		require.NotEmpty(t, f.UID)

		parents, err := store.GetParents(context.Background(), folder.GetParentsQuery{
			UID:   f.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		parentUIDs := []string{}
		for _, p := range parents {
			parentUIDs = append(parentUIDs, p.UID)
		}
		require.Equal(t, ancestorUIDs, parentUIDs)

		ancestorUIDs = append(ancestorUIDs, f.UID)

		parentUID = f.UID
	}

	return ancestorUIDs
}

func CreateLeaves(t *testing.T, store *FolderStoreImpl, parent *folder.Folder, num int) []string {
	t.Helper()

	leaves := make([]string, 0)
	for i := 0; i < num; i++ {
		uid := util.GenerateShortUID()
		f, err := store.Create(context.Background(), folder.CreateFolderCommand{
			Title:     fmt.Sprintf("folder-%s", uid),
			UID:       uid,
			OrgID:     parent.OrgID,
			ParentUID: parent.UID,
		})
		require.NoError(t, err)
		leaves = append(leaves, f.UID)
	}
	return leaves
}

func assertAncestorUIDs(t *testing.T, store *FolderStoreImpl, f *folder.Folder, expected []string) {
	t.Helper()

	ancestors, err := store.GetParents(context.Background(), folder.GetParentsQuery{
		UID:   f.UID,
		OrgID: f.OrgID,
	})
	require.NoError(t, err)
	actualAncestorsUIDs := []string{folder.GeneralFolderUID}
	for _, f := range ancestors {
		actualAncestorsUIDs = append(actualAncestorsUIDs, f.UID)
	}
	assert.Equal(t, expected, actualAncestorsUIDs)
}

func assertChildrenUIDs(t *testing.T, store *FolderStoreImpl, f *folder.Folder, expected []string) {
	t.Helper()

	ancestors, err := store.GetChildren(context.Background(), folder.GetChildrenQuery{
		UID:   f.UID,
		OrgID: f.OrgID,
	})
	require.NoError(t, err)
	actualChildrenUIDs := make([]string, 0)
	for _, f := range ancestors {
		actualChildrenUIDs = append(actualChildrenUIDs, f.UID)
	}
	assert.Equal(t, expected, actualChildrenUIDs)
}
