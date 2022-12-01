package folderimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationCreate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Skip("skipping until folder migration is merged")

	db := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db, db.Cfg, &featuremgmt.FeatureManager{})

	orgID := CreateOrg(t, db)

	t.Run("creating a folder without providing a UID should fail", func(t *testing.T) {
		_, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       "folder1",
			Description: "folder desc",
			OrgID:       orgID,
		})
		require.Error(t, err)
	})

	t.Run("creating a folder with unknown parent should fail", func(t *testing.T) {
		_, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       "folder1",
			OrgID:       orgID,
			ParentUID:   "unknown",
			Description: "folder desc",
			UID:         util.GenerateShortUID(),
		})
		require.Error(t, err)
	})

	t.Run("creating a folder without providing a parent should default to the empty parent folder", func(t *testing.T) {
		uid := util.GenerateShortUID()
		f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       "folder1",
			Description: "folder desc",
			OrgID:       orgID,
			UID:         uid,
		})
		require.NoError(t, err)

		t.Cleanup(func() {
			err := folderStore.Delete(context.Background(), f.UID, orgID)
			require.NoError(t, err)
		})

		assert.Equal(t, "folder1", f.Title)
		assert.Equal(t, "folder desc", f.Description)
		assert.NotEmpty(t, f.ID)
		assert.Equal(t, uid, f.UID)
		assert.Empty(t, f.ParentUID)

		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &f.UID,
			OrgID: orgID,
		})
		assert.NoError(t, err)
		assert.Equal(t, "folder1", ff.Title)
		assert.Equal(t, "folder desc", ff.Description)
		assert.Empty(t, ff.ParentUID)

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
		require.NotEmpty(t, parent.ID)
		assert.Equal(t, parentUID, parent.UID)

		t.Cleanup(func() {
			err := folderStore.Delete(context.Background(), parent.UID, orgID)
			require.NoError(t, err)
		})
		assertAncestorUIDs(t, folderStore, parent, []string{folder.GeneralFolderUID})

		uid := util.GenerateShortUID()
		f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
			Title:       "folder1",
			OrgID:       orgID,
			ParentUID:   parent.UID,
			Description: "folder desc",
			UID:         uid,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			err := folderStore.Delete(context.Background(), f.UID, orgID)
			require.NoError(t, err)
		})

		assert.Equal(t, "folder1", f.Title)
		assert.Equal(t, "folder desc", f.Description)
		assert.NotEmpty(t, f.ID)
		assert.Equal(t, uid, f.UID)
		assert.Equal(t, parentUID, f.ParentUID)

		assertAncestorUIDs(t, folderStore, f, []string{folder.GeneralFolderUID, parent.UID})
		assertChildrenUIDs(t, folderStore, parent, []string{f.UID})

		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &f.UID,
			OrgID: f.OrgID,
		})
		assert.NoError(t, err)
		assert.Equal(t, "folder1", ff.Title)
		assert.Equal(t, "folder desc", ff.Description)
		assert.Equal(t, parentUID, ff.ParentUID)
	})
}

func TestIntegrationDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Skip("skipping until folder migration is merged")

	db := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db, db.Cfg, &featuremgmt.FeatureManager{})

	orgID := CreateOrg(t, db)

	/*
		t.Run("attempt to delete unknown folder should fail", func(t *testing.T) {
			err := folderSrore.Delete(context.Background(), "unknown", orgID)
			assert.Error(t, err)
		})
	*/

	ancestorUIDs := CreateSubTree(t, folderStore, orgID, accesscontrol.GeneralFolderUID, folder.MaxNestedFolderDepth, "")
	require.Len(t, ancestorUIDs, folder.MaxNestedFolderDepth)

	t.Cleanup(func() {
		for _, uid := range ancestorUIDs[1:] {
			err := folderStore.Delete(context.Background(), uid, orgID)
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
		err := folderStore.Delete(context.Background(), ancestorUIDs[len(ancestorUIDs)-1], orgID)
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
	t.Skip("skipping until folder migration is merged")

	db := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db, db.Cfg, &featuremgmt.FeatureManager{})

	orgID := CreateOrg(t, db)

	// create folder
	origTitle := "folder1"
	origDesc := "folder desc"
	f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       origTitle,
		Description: origDesc,
		OrgID:       orgID,
		UID:         util.GenerateShortUID(),
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		err := folderStore.Delete(context.Background(), f.UID, orgID)
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

		_, err = folderStore.Update(context.Background(), folder.UpdateFolderCommand{
			Folder: &folder.Folder{},
		})
		require.Error(t, err)
	})

	t.Run("updating a folder should succeed", func(t *testing.T) {
		newTitle := "new title"
		newDesc := "new desc"
		// existingUpdated := f.Updated
		updated, err := folderStore.Update(context.Background(), folder.UpdateFolderCommand{
			Folder:         f,
			NewTitle:       &newTitle,
			NewDescription: &newDesc,
		})
		require.NoError(t, err)

		assert.Equal(t, f.UID, updated.UID)
		assert.Equal(t, newTitle, updated.Title)
		assert.Equal(t, newDesc, updated.Description)
		// assert.GreaterOrEqual(t, updated.Updated.UnixNano(), existingUpdated.UnixNano())

		updated, err = folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &updated.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, newTitle, updated.Title)
		assert.Equal(t, newDesc, updated.Description)
	})

	t.Run("updating folder UID should succeed", func(t *testing.T) {
		newUID := "new"
		existingTitle := f.Title
		existingDesc := f.Description
		updated, err := folderStore.Update(context.Background(), folder.UpdateFolderCommand{
			Folder: f,
			NewUID: &newUID,
		})
		require.NoError(t, err)

		assert.Equal(t, newUID, updated.UID)

		updated, err = folderStore.Get(context.Background(), folder.GetFolderQuery{
			UID:   &updated.UID,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, newUID, updated.UID)
		assert.Equal(t, existingTitle, updated.Title)
		assert.Equal(t, existingDesc, updated.Description)
	})
}

func TestIntegrationGet(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Skip("skipping until folder migration is merged")

	db := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db, db.Cfg, &featuremgmt.FeatureManager{})

	orgID := CreateOrg(t, db)

	// create folder
	title1 := "folder1"
	desc1 := "folder desc"
	uid1 := util.GenerateShortUID()
	f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       title1,
		Description: desc1,
		OrgID:       orgID,
		UID:         uid1,
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		err := folderStore.Delete(context.Background(), f.UID, orgID)
		require.NoError(t, err)
	})

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
		assert.Equal(t, f.ID, ff.ID)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		//assert.Equal(t, folder.GeneralFolderUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
	})

	t.Run("get folder by title should succeed", func(t *testing.T) {
		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			Title: &f.Title,
			OrgID: orgID,
		})
		require.NoError(t, err)
		assert.Equal(t, f.ID, ff.ID)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		//assert.Equal(t, folder.GeneralFolderUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
	})

	t.Run("get folder by title should succeed", func(t *testing.T) {
		ff, err := folderStore.Get(context.Background(), folder.GetFolderQuery{
			ID: &f.ID,
		})
		require.NoError(t, err)
		assert.Equal(t, f.ID, ff.ID)
		assert.Equal(t, f.UID, ff.UID)
		assert.Equal(t, f.OrgID, ff.OrgID)
		assert.Equal(t, f.Title, ff.Title)
		assert.Equal(t, f.Description, ff.Description)
		//assert.Equal(t, folder.GeneralFolderUID, ff.ParentUID)
		assert.NotEmpty(t, ff.Created)
		assert.NotEmpty(t, ff.Updated)
	})
}

func TestIntegrationGetParents(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Skip("skipping until folder migration is merged")

	db := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db, db.Cfg, &featuremgmt.FeatureManager{})

	orgID := CreateOrg(t, db)

	// create folder
	title1 := "folder1"
	desc1 := "folder desc"
	uid1 := util.GenerateShortUID()
	f, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       title1,
		Description: desc1,
		OrgID:       orgID,
		UID:         uid1,
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		err := folderStore.Delete(context.Background(), f.UID, orgID)
		require.NoError(t, err)
	})

	t.Run("get parents of unknown folder should return an error", func(t *testing.T) {
		_, err := folderStore.GetParents(context.Background(), folder.GetParentsQuery{})
		require.ErrorIs(t, err, folder.ErrFolderNotFound)
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
			parentUIDs = append(parentUIDs, p.UID)
		}
		require.Equal(t, []string{uid1}, parentUIDs)
	})
}

func TestIntegrationGetChildren(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Skip("skipping until folder migration is merged")

	db := sqlstore.InitTestDB(t)
	folderStore := ProvideStore(db, db.Cfg, &featuremgmt.FeatureManager{})

	orgID := CreateOrg(t, db)

	// create folder
	title1 := "folder1"
	desc1 := "folder desc"
	uid1 := util.GenerateShortUID()
	parent, err := folderStore.Create(context.Background(), folder.CreateFolderCommand{
		Title:       title1,
		Description: desc1,
		OrgID:       orgID,
		UID:         uid1,
	})
	require.NoError(t, err)

	treeLeaves := CreateLeaves(t, folderStore, parent, 8)

	t.Cleanup(func() {
		for _, uid := range treeLeaves {
			err := folderStore.Delete(context.Background(), uid, orgID)
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

		if diff := cmp.Diff(treeLeaves[2:4], childrenUIDs); diff != "" {
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

		if diff := cmp.Diff(treeLeaves[4:6], childrenUIDs); diff != "" {
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

		if diff := cmp.Diff(treeLeaves[1:2], childrenUIDs); diff != "" {
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
}

func CreateOrg(t *testing.T, db *sqlstore.SQLStore) int64 {
	t.Helper()

	orgService, err := orgimpl.ProvideService(db, db.Cfg, quotatest.New(false, nil))
	require.NoError(t, err)
	orgID, err := orgService.GetOrCreate(context.Background(), "test-org")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = orgService.Delete(context.Background(), &org.DeleteOrgCommand{ID: orgID})
		require.NoError(t, err)
	})

	return orgID
}

func CreateSubTree(t *testing.T, store *sqlStore, orgID int64, parentUID string, depth int, prefix string) []string {
	t.Helper()

	ancestorUIDs := []string{}
	for i := 0; i < depth; i++ {
		title := fmt.Sprintf("%sfolder-%d", prefix, i)
		cmd := folder.CreateFolderCommand{
			Title:     title,
			OrgID:     orgID,
			ParentUID: parentUID,
			UID:       util.GenerateShortUID(),
		}
		if len(ancestorUIDs) > 0 {
			cmd.ParentUID = ancestorUIDs[len(ancestorUIDs)-1]
		}
		f, err := store.Create(context.Background(), cmd)
		require.NoError(t, err)
		require.Equal(t, title, f.Title)
		require.NotEmpty(t, f.ID)
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
	}

	return ancestorUIDs
}

func CreateLeaves(t *testing.T, store *sqlStore, parent *folder.Folder, num int) []string {
	t.Helper()

	leaves := make([]string, 0)
	for i := 0; i < num; i++ {
		f, err := store.Create(context.Background(), folder.CreateFolderCommand{
			Title:     fmt.Sprintf("folder-%d", i),
			UID:       util.GenerateShortUID(),
			OrgID:     parent.OrgID,
			ParentUID: parent.UID,
		})
		require.NoError(t, err)
		leaves = append(leaves, f.UID)
	}
	return leaves
}

func assertAncestorUIDs(t *testing.T, store *sqlStore, f *folder.Folder, expected []string) {
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

func assertChildrenUIDs(t *testing.T, store *sqlStore, f *folder.Folder, expected []string) {
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
