package folderimpl

import (
	"context"
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

	orgService := orgimpl.ProvideService(db, db.Cfg)
	orgID, err := orgService.GetOrCreate(context.Background(), "test-org")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = orgService.Delete(context.Background(), &org.DeleteOrgCommand{ID: orgID})
		require.NoError(t, err)
	})

	t.Run("creating a 1st level folder should succeed", func(t *testing.T) {
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

		assert.Equal(t, title, f.Title)
		assert.NotEmpty(t, f.ID)
		assert.NotEmpty(t, f.UID)

		parents, err := store.GetParents(context.Background(), &folder.GetParentsCommand{
			UID: f.UID,
		})
		require.NoError(t, err)
		assert.Len(t, parents, 1)
		assert.Equal(t, accesscontrol.GeneralFolderUID, parents[0].UID)
	})

	t.Run("creating a folder with unknown parent should fail", func(t *testing.T) {
		title := "folder1"
		_, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title: title,
			// OrgID: orgID,
			ParentUID: "unknown",
		})
		require.Error(t, err)
	})

	t.Run("creating a folder with known parent should succeed", func(t *testing.T) {
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
		assert.Equal(t, accesscontrol.GeneralFolderUID, ancestors[0])

		title = "folder2"
		f, err := store.Create(context.Background(), &folder.CreateFolderCommand{
			Title: title,
			// OrgID: orgID,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			err := store.Delete(context.Background(), f.UID, orgID)
			require.NoError(t, err)
		})

		assert.Equal(t, title, f.Title)
		assert.NotEmpty(t, f.ID)
		assert.NotEmpty(t, f.UID)

		ancestors, err = store.GetParents(context.Background(), &folder.GetParentsCommand{
			UID: f.UID,
		})
		require.NoError(t, err)
		assert.Len(t, ancestors, 2)
		assert.Equal(t, accesscontrol.GeneralFolderUID, ancestors[0].UID)
		assert.Equal(t, parent.UID, ancestors[1].UID)
	})
}

func TestDelete(t *testing.T) {

}

func TestUpdate(t *testing.T) {}

func TestMove(t *testing.T) {}

func TestGet(t *testing.T) {}

func TestGetParent(t *testing.T) {}

func TestGetParents(t *testing.T) {}

func TestGetChildren(t *testing.T) {}

func TestGetDescendents(t *testing.T) {}
