package export

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/sets"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

var testDashboards = resources.DashboardResource.GroupResource()

func folderCountsRow(n int64) folderv1.ResourceStats {
	return folderv1.ResourceStats{Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource, Count: n}
}

func dashboardCountsRow(n int64) folderv1.ResourceStats {
	return folderv1.ResourceStats{Group: testDashboards.Group, Resource: testDashboards.Resource, Count: n}
}

var alertRuleCountsRow = folderv1.ResourceStats{Group: "rules.alerting.grafana.app", Resource: "alertrules", Count: 1}

func blockingFolderIDs(blocking []blockingFolder) []string {
	ids := make([]string, 0, len(blocking))
	for _, b := range blocking {
		ids = append(ids, b.folder.ID)
	}
	return ids
}

func TestFolderUIDPlanner_CheckFolders(t *testing.T) {
	// FolderA
	// ├── FolderB1     2 dashboards, 1 alert rule
	// │   └── FolderB1-C   1 dashboard, 1 alert rule
	// └── FolderB2     2 dashboards
	//     └── FolderB2-C   2 dashboards, 1 alert rule
	// FolderX          1 dashboard
	// └── FolderX-1    1 dashboard
	newTree := func() resources.FolderTree {
		tree := resources.NewEmptyFolderTree()
		tree.Add(resources.Folder{ID: "a", Title: "FolderA"}, "")
		tree.Add(resources.Folder{ID: "b1", Title: "FolderB1"}, "a")
		tree.Add(resources.Folder{ID: "b1c", Title: "FolderB1-C"}, "b1")
		tree.Add(resources.Folder{ID: "b2", Title: "FolderB2"}, "a")
		tree.Add(resources.Folder{ID: "b2c", Title: "FolderB2-C"}, "b2")
		tree.Add(resources.Folder{ID: "x", Title: "FolderX"}, "")
		tree.Add(resources.Folder{ID: "x1", Title: "FolderX-1"}, "x")
		return tree
	}
	baseCounts := func() map[string][]folderv1.ResourceStats {
		return map[string][]folderv1.ResourceStats{
			"a":   {folderCountsRow(2)},
			"b1":  {folderCountsRow(1), dashboardCountsRow(2), alertRuleCountsRow},
			"b1c": {dashboardCountsRow(1), alertRuleCountsRow},
			"b2":  {folderCountsRow(1), dashboardCountsRow(2)},
			"b2c": {dashboardCountsRow(2), alertRuleCountsRow},
			"x":   {folderCountsRow(1), dashboardCountsRow(1)},
			"x1":  {dashboardCountsRow(1)},
		}
	}
	allExported := func() exportedCounts {
		return exportedCounts{
			"b1":  {testDashboards: 2},
			"b1c": {testDashboards: 1},
			"b2":  {testDashboards: 2},
			"b2c": {testDashboards: 2},
			"x":   {testDashboards: 1},
			"x1":  {testDashboards: 1},
		}
	}
	foldersWithAlertRules := []string{"b1", "b1c", "b2c"}

	tests := []struct {
		name      string
		counts    func(map[string][]folderv1.ResourceStats)
		exported  func(exportedCounts)
		countsErr map[string]error
		// wantMigratable are the cleanly migratable folders.
		wantMigratable []string
		// wantBlocking are the folders whose own contents are not migrated.
		wantBlocking []string
	}{
		{
			name:           "an alert rule makes its folder blocking, and its parents are not migratable",
			wantMigratable: []string{"x", "x1"},
			wantBlocking:   foldersWithAlertRules,
		},
		{
			name: "folders without unsupported resources are all migratable",
			counts: func(c map[string][]folderv1.ResourceStats) {
				c["b1"] = []folderv1.ResourceStats{folderCountsRow(1), dashboardCountsRow(2)}
				c["b1c"] = []folderv1.ResourceStats{dashboardCountsRow(1)}
				c["b2c"] = []folderv1.ResourceStats{dashboardCountsRow(2)}
			},
			wantMigratable: []string{"a", "b1", "b1c", "b2", "b2c", "x", "x1"},
			wantBlocking:   []string{},
		},
		{
			name: "a legacy count blocks the folder",
			counts: func(c map[string][]folderv1.ResourceStats) {
				c["x1"] = []folderv1.ResourceStats{dashboardCountsRow(1), {Group: "sql-fallback", Resource: "library_elements", Count: 1}}
			},
			wantMigratable: []string{},
			wantBlocking:   append([]string{"x1"}, foldersWithAlertRules...),
		},
		{
			name: "a dashboard that is not exported blocks the folder",
			exported: func(e exportedCounts) {
				e["x1"][testDashboards] = 0
			},
			wantMigratable: []string{},
			wantBlocking:   append([]string{"x1"}, foldersWithAlertRules...),
		},
		{
			name: "a child folder that is not exported blocks the folder",
			counts: func(c map[string][]folderv1.ResourceStats) {
				c["x1"] = []folderv1.ResourceStats{folderCountsRow(1), dashboardCountsRow(1)}
			},
			wantMigratable: []string{},
			wantBlocking:   append([]string{"x1"}, foldersWithAlertRules...),
		},
		{
			name: "an unsupported kind blocks the folder",
			counts: func(c map[string][]folderv1.ResourceStats) {
				c["x1"] = []folderv1.ResourceStats{dashboardCountsRow(1), {Group: "dashboard.grafana.app", Resource: "variables", Count: 1}}
			},
			wantMigratable: []string{},
			wantBlocking:   append([]string{"x1"}, foldersWithAlertRules...),
		},
		{
			name:           "a folder without counts is blocking",
			countsErr:      map[string]error{"x1": errors.New("counts unavailable")},
			wantMigratable: []string{},
			wantBlocking:   append([]string{"x1"}, foldersWithAlertRules...),
		},
		{
			name:           "a parent without counts does not block its child folders",
			countsErr:      map[string]error{"x": errors.New("counts unavailable")},
			wantMigratable: []string{"x1"},
			wantBlocking:   append([]string{"x"}, foldersWithAlertRules...),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			counts := baseCounts()
			if tt.counts != nil {
				tt.counts(counts)
			}
			exported := allExported()
			if tt.exported != nil {
				tt.exported(exported)
			}

			planner := &folderUIDPlanner{
				supported: sets.New(testDashboards),
				exported:  exported,
				getCounts: func(_ context.Context, uid string) ([]folderv1.ResourceStats, error) {
					if err := tt.countsErr[uid]; err != nil {
						return nil, err
					}
					return counts[uid], nil
				},
			}

			check := planner.checkFolders(context.Background(), newTree())

			migratable := make([]string, 0, len(check.cleanlyMigratable))
			for id := range check.cleanlyMigratable {
				migratable = append(migratable, id)
			}
			require.ElementsMatch(t, tt.wantMigratable, migratable)
			require.ElementsMatch(t, tt.wantBlocking, blockingFolderIDs(check.blockingFolders))
		})
	}

	t.Run("a blocking folder names what is left behind and its top-level folder", func(t *testing.T) {
		counts := baseCounts()
		counts["b2c"] = []folderv1.ResourceStats{dashboardCountsRow(3), alertRuleCountsRow}
		planner := &folderUIDPlanner{
			supported: sets.New(testDashboards),
			exported:  allExported(),
			getCounts: func(_ context.Context, uid string) ([]folderv1.ResourceStats, error) {
				return counts[uid], nil
			},
		}

		check := planner.checkFolders(context.Background(), newTree())

		var b2c *blockingFolder
		for i := range check.blockingFolders {
			if check.blockingFolders[i].folder.ID == "b2c" {
				b2c = &check.blockingFolders[i]
			}
		}
		require.NotNil(t, b2c)
		require.Equal(t, "1 dashboards that are not migrated, 1 alertrules.rules.alerting.grafana.app", b2c.reason)
		require.Equal(t, "a", b2c.topLevelFolder.ID)
	})
}

func TestFolderUIDPlanner_Plan(t *testing.T) {
	// A
	// ├── B   alert rule
	// └── C
	// D
	newTree := func() resources.FolderTree {
		tree := resources.NewEmptyFolderTree()
		tree.Add(resources.Folder{ID: "a", Title: "A"}, "")
		tree.Add(resources.Folder{ID: "b", Title: "B"}, "a")
		tree.Add(resources.Folder{ID: "c", Title: "C"}, "a")
		tree.Add(resources.Folder{ID: "d", Title: "D"}, "")
		return tree
	}
	counts := map[string][]folderv1.ResourceStats{
		"a": {folderCountsRow(2)},
		"b": {alertRuleCountsRow},
	}

	newPlanner := func(generateNewIDs bool) *folderUIDPlanner {
		return &folderUIDPlanner{
			options:   resources.FolderCheckOptions{GenerateNewIDs: generateNewIDs},
			supported: sets.New(testDashboards),
			exported:  exportedCounts{},
			getCounts: func(_ context.Context, uid string) ([]folderv1.ResourceStats, error) {
				return counts[uid], nil
			},
		}
	}

	t.Run("folders that cannot keep their UID get a new one", func(t *testing.T) {
		plan := newPlanner(true).plan(context.Background(), newTree())

		require.Equal(t, map[string]struct{}{"a": {}, "b": {}}, plan.newIDs)
		require.Empty(t, plan.skipped)
		require.Empty(t, plan.skippedTopLevelFolders)
		require.Empty(t, plan.blockingFolders)
	})

	t.Run("without new UIDs, the whole subtree of a blocking folder is not migrated", func(t *testing.T) {
		plan := newPlanner(false).plan(context.Background(), newTree())

		require.Empty(t, plan.newIDs)
		require.Equal(t, map[string]struct{}{"a": {}, "b": {}, "c": {}}, plan.skipped, "C is migratable, but its parent is not migrated")
		require.Len(t, plan.skippedTopLevelFolders, 1)
		require.Equal(t, "a", plan.skippedTopLevelFolders[0].ID)

		require.Equal(t, []string{"b"}, blockingFolderIDs(plan.blockingFolders), "only the folder with the alert rule is reported")
		require.EqualError(t, blockingFolderError(plan.blockingFolders[0]),
			`folder "B" contains 1 alertrules.rules.alerting.grafana.app, so its top-level folder "A" and the folders in it are not migrated`)
	})
}

func TestFolderUIDCheckRequested(t *testing.T) {
	folderCheck := &resources.FolderCheckOptions{GenerateNewIDs: true}

	require.True(t, folderUIDCheckRequested(provisioning.ExportJobOptions{}, folderCheck))
	require.False(t, folderUIDCheckRequested(provisioning.ExportJobOptions{GenerateNewFolderIDs: true}, folderCheck), "every folder gets a new UID, so there is nothing to check")
	require.False(t, folderUIDCheckRequested(provisioning.ExportJobOptions{}, nil), "only the migration turns the check on")
}
