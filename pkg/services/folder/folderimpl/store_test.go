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

	t.Run("creating a 1st level folder without providing a parent should default to the root folder", func(t *testing.T) {
		title := "folder1"
		desc := "folder desc"
		f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title:       title,
			Description: desc,
			// OrgID: orgID,
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

		parents, err := store.GetParents(context.Background(), &folder.GetParentsCommand{
			UID: f.UID,
		})
		require.NoError(t, err)
		assert.Len(t, parents, 1)
		assert.Equal(t, folder.GeneralFolderUID, parents[0].UID)

		ff, err := store.Get(context.Background(), &folder.GetFolderCommand{
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
			Title: title,
			// OrgID: orgID,
			ParentUID:   "unknown",
			Description: desc,
		})
		require.Error(t, err)
	})

	t.Run("creating a folder with a known parent should succeed", func(t *testing.T) {
		title := "folder1"
		parent, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title: title,
			// OrgID: orgID,
		})
		require.NoError(t, err)
		require.Equal(t, title, parent.Title)
		require.NotEmpty(t, parent.ID)
		assert.NotEmpty(t, parent.UID)
		t.Cleanup(func() {
			err := store.Delete(context.Background(), parent.UID, orgID)
			require.NoError(t, err)
		})
		ancestors, err := store.GetParents(context.Background(), &folder.GetParentsCommand{
			UID: parent.UID,
		})
		require.NoError(t, err)
		assert.Len(t, ancestors, 1)
		assert.Equal(t, folder.GeneralFolderUID, ancestors[0])

		title = "folder2"
		desc := "folder desc"
		f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title: title,
			// OrgID: orgID,
			ParentUID:   parent.UID,
			Description: desc,
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

		ancestors, err = store.GetParents(context.Background(), &folder.GetParentsCommand{
			UID: f.UID,
		})
		require.NoError(t, err)
		assert.Len(t, ancestors, 2)
		assert.Equal(t, accesscontrol.GeneralFolderUID, ancestors[0].UID)
		assert.Equal(t, parent.UID, ancestors[1].UID)

		ff, err := store.Get(context.Background(), &folder.GetFolderCommand{
			UID: &f.UID,
		})
		assert.NoError(t, err)
		assert.Equal(t, title, ff.Title)
		assert.Equal(t, desc, ff.Description)
	})

	t.Run("creating a nested folder with the maximum nested folder depth should fail", func(t *testing.T) {
		ancestorUIDs := []string{accesscontrol.GeneralFolderUID}
		for i := 0; i < folder.MaxNestedFolderDepth; i++ {
			parentUID := ancestorUIDs[len(ancestorUIDs)-1]
			title := fmt.Sprintf("folder-%d", i)
			f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
				Title: title,
				// OrgID: orgID,
				ParentUID: parentUID,
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

			parents, err := store.GetParents(context.Background(), &folder.GetParentsCommand{
				UID: f.UID,
			})
			require.NoError(t, err)
			parentUIDs := make([]string, len(ancestorUIDs))
			for _, p := range parents {
				parentUIDs = append(parentUIDs, p.UID)
			}
			require.Equal(t, ancestorUIDs, parentUIDs)
		}

		title := fmt.Sprintf("folder-%d", len(ancestorUIDs))
		_, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title: title,
			// OrgID: orgID,
			ParentUID: ancestorUIDs[len(ancestorUIDs)-1],
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

	ancestorUIDs := []string{folder.GeneralFolderUID}
	for i := 0; i < folder.MaxNestedFolderDepth; i++ {
		parentUID := ancestorUIDs[len(ancestorUIDs)-1]
		title := fmt.Sprintf("folder-%d", i)
		f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title: title,
			// OrgID: orgID,
			ParentUID: parentUID,
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

		parents, err := store.GetParents(context.Background(), &folder.GetParentsCommand{
			UID: f.UID,
		})
		require.NoError(t, err)
		parentUIDs := make([]string, len(ancestorUIDs))
		for _, p := range parents {
			parentUIDs = append(parentUIDs, p.UID)
		}
		require.Equal(t, ancestorUIDs, parentUIDs)
	}

	require.Len(t, ancestorUIDs, folder.MaxNestedFolderDepth)

	t.Run("deleting folder with children should fail", func(t *testing.T) {
		err = store.Delete(context.Background(), ancestorUIDs[2], orgID)
		require.Error(t, err)
	})

	t.Run("deleting a leaf folder should succeed", func(t *testing.T) {
		err = store.Delete(context.Background(), ancestorUIDs[len(ancestorUIDs)-1], orgID)
		require.NoError(t, err)

		children, err := store.GetChildren(context.Background(), &folder.GetTreeCommand{
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
		// OrgID: orgID,
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

		ff, err := store.Get(context.Background(), &folder.GetFolderCommand{
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

		updated, err = store.Get(context.Background(), &folder.GetFolderCommand{
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

		updated, err = store.Get(context.Background(), &folder.GetFolderCommand{
			UID: &updated.UID,
		})
		require.NoError(t, err)
		assert.Equal(t, origTitle, updated.Title)
		assert.Equal(t, origDesc, updated.Description)
	})
}

func TestMove(t *testing.T) {}

func TestGet(t *testing.T) {}

func TestGetParent(t *testing.T) {}

func TestGetParents(t *testing.T) {}

func TestGetChildren(t *testing.T) {}

func TestGetDescendents(t *testing.T) {}
