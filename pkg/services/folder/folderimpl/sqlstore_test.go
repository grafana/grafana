package folderimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreate(t *testing.T) {
	db := sqlstore.InitTestDB(t)
	store := ProvideStore(db, db.Cfg, *featuremgmt.WithFeatures())

	// create org
	orgService := orgimpl.ProvideService(db, db.Cfg)
	orgID, err := orgService.GetOrCreate(context.Background(), "test-org")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = orgService.Delete(context.Background(), &org.DeleteOrgCommand{ID: orgID})
		require.NoError(t, err)
	})

	t.Run("creating a 1st level folder without providing a UID should fail", func(t *testing.T) {
		title := "folder1"
		desc := "folder desc"

		_, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title:       title,
			Description: desc,
			OrgID:       orgID,
		})
		require.Error(t, err)
	})

	t.Run("creating a 1st level folder without providing a parent should default to the root folder", func(t *testing.T) {
		title := "folder1"
		desc := "folder desc"

		f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title:       title,
			Description: desc,
			OrgID:       orgID,
			UID:         util.GenerateShortUID(),
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			err := store.Delete(context.Background(), f.UID, orgID)
			require.NoError(t, err)
		})

		assert.Equal(t, title, f.Title)
		assert.Equal(t, desc, f.Description)
		assert.NotEmpty(t, f.ID)
		assert.NotEmpty(t, f.UID)

		assertAncestorUIDs(t, store, f.UID, []string{folder.GeneralFolderUID})

		ff, err := store.Get(context.Background(), &folder.GetFolderQuery{
			UID: &f.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, title, ff.Title)
		assert.Equal(t, desc, ff.Description)
	})

	t.Run("creating a folder with unknown parent should fail", func(t *testing.T) {
		title := "folder1"
		desc := "folder desc"
		_, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title:       title,
			OrgID:       orgID,
			ParentUID:   "unknown",
			Description: desc,
			UID:         util.GenerateShortUID(),
		})
		require.Error(t, err)
	})

	t.Run("creating a folder with a known parent should succeed", func(t *testing.T) {
		title := "folder1"
		parent, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title: title,
			OrgID: orgID,
			UID:   util.GenerateShortUID(),
		})
		require.NoError(t, err)
		require.Equal(t, title, parent.Title)
		require.NotEmpty(t, parent.ID)
		assert.NotEmpty(t, parent.UID)
		t.Cleanup(func() {
			err := store.Delete(context.Background(), parent.UID, orgID)
			require.NoError(t, err)
		})
		assertAncestorUIDs(t, store, parent.UID, []string{folder.GeneralFolderUID})

		title = "folder2"
		desc := "folder desc"
		f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title:       title,
			OrgID:       orgID,
			ParentUID:   parent.UID,
			Description: desc,
			UID:         util.GenerateShortUID(),
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			err := store.Delete(context.Background(), f.UID, orgID)
			require.NoError(t, err)
		})

		assert.Equal(t, title, f.Title)
		assert.Equal(t, desc, f.Description)
		assert.NotEmpty(t, f.ID)
		assert.NotEmpty(t, f.UID)

		assertAncestorUIDs(t, store, f.UID, []string{folder.GeneralFolderUID, parent.UID})
		assertChildrenUIDs(t, store, parent.UID, []string{f.UID})

		ff, err := store.Get(context.Background(), &folder.GetFolderQuery{
			UID: &f.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, title, ff.Title)
		assert.Equal(t, desc, ff.Description)
	})

	t.Run("creating a nested folder with the maximum nested folder depth should fail", func(t *testing.T) {
		ancestorUIDs := createSubTree(t, store, orgID, accesscontrol.GeneralFolderUID, folder.MaxNestedFolderDepth, "")

		title := fmt.Sprintf("folder-%d", len(ancestorUIDs))
		_, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title:     title,
			OrgID:     orgID,
			ParentUID: ancestorUIDs[len(ancestorUIDs)-1],
			UID:       util.GenerateShortUID(),
		})
		assert.Error(t, err)
	})
}

func TestDelete(t *testing.T) {
	db := sqlstore.InitTestDB(t)
	store := ProvideStore(db, db.Cfg, *featuremgmt.WithFeatures())

	// create an org
	orgService := orgimpl.ProvideService(db, db.Cfg)
	orgID, err := orgService.GetOrCreate(context.Background(), "test-org")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = orgService.Delete(context.Background(), &org.DeleteOrgCommand{ID: orgID})
		require.NoError(t, err)
	})

	t.Run("attempt to delete root folder should fail", func(t *testing.T) {
		err := store.Delete(context.Background(), folder.GeneralFolderUID, orgID)
		assert.Error(t, err)
	})

	t.Run("attempt to delete unknown folder should fail", func(t *testing.T) {
		err := store.Delete(context.Background(), "unknown", orgID)
		assert.Error(t, err)
	})

	ancestorUIDs := createSubTree(t, store, orgID, accesscontrol.GeneralFolderUID, folder.MaxNestedFolderDepth, "")
	require.Len(t, ancestorUIDs, folder.MaxNestedFolderDepth)

	t.Run("deleting folder with children should fail", func(t *testing.T) {
		err = store.Delete(context.Background(), ancestorUIDs[2], orgID)
		require.Error(t, err)
	})

	t.Run("deleting a leaf folder should succeed", func(t *testing.T) {
		err = store.Delete(context.Background(), ancestorUIDs[len(ancestorUIDs)-1], orgID)
		require.NoError(t, err)

		children, err := store.GetChildren(context.Background(), &folder.GetTreeQuery{
			UID:   ancestorUIDs[len(ancestorUIDs)-2],
			Depth: folder.MaxNestedFolderDepth,
		})
		require.NoError(t, err)
		assert.Len(t, children, 0)
	})
}

func TestUpdate(t *testing.T) {
	db := sqlstore.InitTestDB(t)
	store := ProvideStore(db, db.Cfg, *featuremgmt.WithFeatures())

	// create an org
	orgService := orgimpl.ProvideService(db, db.Cfg)
	orgID, err := orgService.GetOrCreate(context.Background(), "test-org")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = orgService.Delete(context.Background(), &org.DeleteOrgCommand{ID: orgID})
		require.NoError(t, err)
	})

	// create folder
	origTitle := "folder1"
	origDesc := "folder desc"
	f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
		Title:       origTitle,
		Description: origDesc,
		OrgID:       orgID,
		UID:         util.GenerateShortUID(),
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		err := store.Delete(context.Background(), f.UID, orgID)
		require.NoError(t, err)
	})

	t.Run("updating an unknown folder should fail", func(t *testing.T) {
		newTitle := "new title"
		newDesc := "new desc"
		_, err := store.Update(context.Background(), &folder.UpdateFolderCommand{
			Folder:         f,
			NewTitle:       &newTitle,
			NewDescription: &newDesc,
		})
		require.NoError(t, err)

		ff, err := store.Get(context.Background(), &folder.GetFolderQuery{
			UID: &f.UID,
		})
		require.NoError(t, err)

		assert.Equal(t, origTitle, ff.Title)
		assert.Equal(t, origDesc, ff.Description)
	})

	t.Run("updating a folder should succeed", func(t *testing.T) {
		newTitle := "new title"
		newDesc := "new desc"
		updated, err := store.Update(context.Background(), &folder.UpdateFolderCommand{
			Folder:         f,
			NewTitle:       &newTitle,
			NewDescription: &newDesc,
		})
		require.NoError(t, err)

		assert.Equal(t, f.UID, updated.UID)
		assert.Equal(t, newTitle, updated.Title)
		assert.Equal(t, newDesc, updated.Description)

		updated, err = store.Get(context.Background(), &folder.GetFolderQuery{
			UID: &updated.UID,
		})
		require.NoError(t, err)
		assert.Equal(t, newTitle, updated.Title)
		assert.Equal(t, newDesc, updated.Description)
	})

	t.Run("updating folder UID should succeed", func(t *testing.T) {
		newUID := "new"
		updated, err := store.Update(context.Background(), &folder.UpdateFolderCommand{
			Folder: f,
			NewUID: &newUID,
		})
		require.NoError(t, err)

		assert.Equal(t, newUID, updated.UID)

		updated, err = store.Get(context.Background(), &folder.GetFolderQuery{
			UID: &updated.UID,
		})
		require.NoError(t, err)
		assert.Equal(t, origTitle, updated.Title)
		assert.Equal(t, origDesc, updated.Description)
	})
}

/*
func TestMove(t *testing.T) {
	db := sqlstore.InitTestDB(t)
	store := ProvideStore(db, db.Cfg, *featuremgmt.WithFeatures())

	// create org
	orgService := orgimpl.ProvideService(db, db.Cfg)
	orgID, err := orgService.GetOrCreate(context.Background(), "test-org")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = orgService.Delete(context.Background(), &org.DeleteOrgCommand{ID: orgID})
		require.NoError(t, err)
	})

	t.Run("moving unknown folder should fail", func(t *testing.T) {
		_, err = store.Move(context.Background(), &folder.MoveFolderCommand{
			UID: "unknown",
		})
		require.Error(t, err)
	})

	t.Run("moving to unknown folder should fail", func(t *testing.T) {
		title := "folder1"
		f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title: title,
			// OrgID: orgID,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			err := store.Delete(context.Background(), f.UID, orgID)
			require.NoError(t, err)
		})

		_, err = store.Move(context.Background(), &folder.MoveFolderCommand{
			UID:          f.UID,
			NewParentUID: "unknown",
		})
		require.Error(t, err)
	})

	t.Run("moving to an existing folder under the same organisation should succeed", func(t *testing.T) {
		subTree1 := createSubTree(t, store, orgID, folder.GeneralFolderUID, 2, "tree1-")
		f1 := subTree1[1]
		children := subTree1[2 : len(subTree1)-1]
		subTree2 := createSubTree(t, store, orgID, folder.GeneralFolderUID, 2, "tree2-")
		f2 := subTree2[1]

		_, err = store.Move(context.Background(), &folder.MoveFolderCommand{
			UID:          f1,
			NewParentUID: f2,
		})
		require.NoError(t, err)

		assertAncestorUIDs(t, store, f1, []string{folder.GeneralFolderUID, f2})
		assertChildrenUIDs(t, store, f1, children)
	})

	t.Run("moving to an existing folder under the same organisation that would cause the maximum depth to exceed should fail", func(t *testing.T) {
		subTree1 := createSubTree(t, store, orgID, folder.GeneralFolderUID, 2, "tree1-")
		f1 := subTree1[1]
		children := subTree1[2 : len(subTree1)-1]
		subTree2 := createSubTree(t, store, orgID, folder.GeneralFolderUID, folder.MaxNestedFolderDepth-len(children), "tree2-")
		f2 := subTree2[1]

		_, err = store.Move(context.Background(), &folder.MoveFolderCommand{
			UID:          f1,
			NewParentUID: f2,
		})
		require.Error(t, err)
	})

	t.Run("moving to folder under a different folder should fail", func(t *testing.T) {
		// create another org
		otherOrgID, err := orgService.GetOrCreate(context.Background(), "test-org-2")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = orgService.Delete(context.Background(), &org.DeleteOrgCommand{ID: otherOrgID})
			require.NoError(t, err)
		})

		subTree1 := createSubTree(t, store, orgID, folder.GeneralFolderUID, 1, "")
		f1 := subTree1[len(subTree1)-1]
		subTree2 := createSubTree(t, store, otherOrgID, folder.GeneralFolderUID, 1, "")
		f2 := subTree2[len(subTree2)-1]

		_, err = store.Move(context.Background(), &folder.MoveFolderCommand{
			UID:          f1,
			NewParentUID: f2,
		})
		require.Error(t, err)
	})
}
*/

func TestGet(t *testing.T) {}

func TestGetParent(t *testing.T) {}

func TestGetParents(t *testing.T) {}

func TestGetChildren(t *testing.T) {}

func TestGetDescendents(t *testing.T) {}

func createSubTree(t *testing.T, store *sqlStore, orgID int64, parentUID string, depth int, prefix string) []string {
	t.Helper()

	ancestorUIDs := []string{parentUID}
	for i := 0; i < int(depth); i++ {
		parentUID := ancestorUIDs[len(ancestorUIDs)-1]
		title := fmt.Sprintf("%sfolder-%d", prefix, i)
		f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title:     title,
			OrgID:     orgID,
			ParentUID: parentUID,
			UID:       util.GenerateShortUID(),
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			err := store.Delete(context.Background(), f.UID, orgID)
			require.NoError(t, err)
		})

		require.Equal(t, title, f.Title)
		require.NotEmpty(t, f.ID)
		require.NotEmpty(t, f.UID)

		ancestorUIDs = append(ancestorUIDs, f.UID)

		parents, err := store.GetParents(context.Background(), &folder.GetParentsQuery{
			UID: f.UID,
		})
		require.NoError(t, err)
		parentUIDs := make([]string, len(ancestorUIDs))
		for _, p := range parents {
			parentUIDs = append(parentUIDs, p.UID)
		}
		require.Equal(t, ancestorUIDs, parentUIDs)
	}
	return ancestorUIDs
}

func assertAncestorUIDs(t *testing.T, store *sqlStore, UID string, expected []string) {
	ancestors, err := store.GetParents(context.Background(), &folder.GetParentsQuery{
		UID: UID,
	})
	require.NoError(t, err)
	actualAncestorsUIDs := make([]string, 0)
	for _, f := range ancestors {
		actualAncestorsUIDs = append(actualAncestorsUIDs, f.UID)
	}
	assert.Equal(t, expected, actualAncestorsUIDs)
}

func assertChildrenUIDs(t *testing.T, store *sqlStore, UID string, expected []string) {
	ancestors, err := store.GetChildren(context.Background(), &folder.GetTreeQuery{
		UID: UID,
	})
	require.NoError(t, err)
	actualChildrenUIDs := make([]string, 0)
	for _, f := range ancestors {
		actualChildrenUIDs = append(actualChildrenUIDs, f.UID)
	}
	assert.Equal(t, expected, actualChildrenUIDs)
}
