package folderreconcile

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/model"
)

type fakeConsumer struct {
	name    string
	inUse   map[int64][]string
	deleted []string
}

func (c *fakeConsumer) Name() string { return c.name }

func (c *fakeConsumer) FoldersInUse(_ context.Context, orgID int64) ([]string, error) {
	return c.inUse[orgID], nil
}

func (c *fakeConsumer) DeleteInFolder(_ context.Context, _ int64, folderUID string) error {
	c.deleted = append(c.deleted, folderUID)
	return nil
}

type fakeOrgs struct{ ids []int64 }

func (o *fakeOrgs) Search(_ context.Context, _ *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	dtos := make([]*org.OrgDTO, 0, len(o.ids))
	for _, id := range o.ids {
		dtos = append(dtos, &org.OrgDTO{ID: id})
	}
	return dtos, nil
}

// fakeFolders lets the search result and the double-check Get diverge per UID.
type fakeFolders struct {
	*foldertest.FakeService
	inSearch map[string]bool
	inGet    map[string]bool
}

func (f *fakeFolders) SearchFolders(_ context.Context, q folder.SearchFoldersQuery) (model.HitList, error) {
	var hits model.HitList
	for _, uid := range q.UIDs {
		if f.inSearch[uid] {
			hits = append(hits, &model.Hit{UID: uid})
		}
	}
	return hits, nil
}

func (f *fakeFolders) Get(_ context.Context, q *folder.GetFolderQuery) (*folder.Folder, error) {
	if q.UID != nil && f.inGet[*q.UID] {
		return &folder.Folder{UID: *q.UID}, nil
	}
	return nil, dashboards.ErrFolderNotFound
}

func TestReconcile(t *testing.T) {
	// Folders referenced across two consumers: "exists" is live, "gone" is truly deleted,
	// "racy" is missing from search but the double-check Get still finds it, and "general" is skipped.
	alerts := &fakeConsumer{name: "alerts", inUse: map[int64][]string{1: {"exists", "gone", folder.GeneralFolderUID}}}
	panels := &fakeConsumer{name: "panels", inUse: map[int64][]string{1: {"gone", "racy", ""}}}
	folders := &fakeFolders{
		FakeService: foldertest.NewFakeService(),
		inSearch:    map[string]bool{"exists": true},
		inGet:       map[string]bool{"exists": true, "racy": true},
	}

	r := newReconciler(folders, &fakeOrgs{ids: []int64{1}}, 0, alerts, panels)
	require.NoError(t, r.reconcile(context.Background()))

	// Only the truly missing "gone" folder is cleaned up, for every consumer that referenced it.
	require.Equal(t, []string{"gone"}, alerts.deleted)
	require.Equal(t, []string{"gone"}, panels.deleted)
}
