package plan_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/plan"
)

// The contract's central claim, tested against provisioning's own shapes: a
// commit diff narrows the work and does not change the answer.
//
// This is the case issue #130899 reported. A dashboard is renamed onto a path
// Grafana cannot address. Today full sync deletes it silently and incremental
// keeps it silently — same repository, same ref, two different Grafana states,
// neither reported. Here both modes produce the same plan.
func TestFullAndIncrementalConverge(t *testing.T) {
	tests := []struct {
		name    string
		tree    []repository.FileTreeEntry
		items   []provisioning.ResourceListItem
		changes []repository.VersionedFileChange
	}{
		{
			name: "rename onto an unaddressable path",
			tree: []repository.FileTreeEntry{dir("team/"), blob("team/Backend & UI.json", "h1")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/dashboard.json", "d1", "h1"),
			},
			changes: []repository.VersionedFileChange{{
				Action:       repository.FileActionRenamed,
				Path:         "team/Backend & UI.json",
				PreviousPath: "team/dashboard.json",
			}},
		},
		{
			name: "ordinary rename keeps the identity",
			tree: []repository.FileTreeEntry{dir("team/"), blob("team/renamed.json", "h1")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/dashboard.json", "d1", "h1"),
			},
			changes: []repository.VersionedFileChange{{
				Action:       repository.FileActionRenamed,
				Path:         "team/renamed.json",
				PreviousPath: "team/dashboard.json",
			}},
		},
		{
			name: "content change in place",
			tree: []repository.FileTreeEntry{dir("team/"), blob("team/dashboard.json", "h2")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/dashboard.json", "d1", "h1"),
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionUpdated, Path: "team/dashboard.json",
			}},
		},
		{
			name: "file added into a new folder",
			tree: []repository.FileTreeEntry{dir("team/"), dir("team/new/"), blob("team/new/one.json", "h9")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionCreated, Path: "team/new/one.json",
			}},
		},
		{
			name: "file deleted from the repository",
			tree: []repository.FileTreeEntry{dir("team/")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/gone.json", "d1", "h1"),
			},
			changes: []repository.VersionedFileChange{{
				Action: repository.FileActionDeleted, Path: "team/gone.json",
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			list := &provisioning.ResourceList{Items: tt.items}
			desired := plan.Declare(tt.tree, nil)
			observed := mustObserve(list)
			cfg := converge.WithContainers(plan.FolderConfig(repoName))

			full, err := converge.NewPlan(desired, observed, cfg)
			require.NoError(t, err)

			incremental, err := converge.NewPlan(desired, observed, cfg,
				converge.WithHints(plan.Hints(tt.changes, true)))
			require.NoError(t, err)

			start := startFrom(list)
			require.Equal(t,
				applyPlan(start, full).String(),
				applyPlan(start, incremental).String(),
				"modes diverge\nfull:\n%s\nincremental:\n%s", full, incremental)

			// The incremental run must also report the same exclusions. Today
			// a warning outside the incremental window goes unmentioned until
			// the next full sync.
			require.Equal(t, full.Exclusions, incremental.Exclusions)
		})
	}
}

// An incremental run that cannot vouch for its window must not narrow the
// scan: a force-push or an unknown previous ref falls back to a full plan.
func TestIncompleteHintsFallBackToFull(t *testing.T) {
	tree := []repository.FileTreeEntry{dir("team/"), blob("team/one.json", "h1")}
	list := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{
		folderItem("team/", ""),
		resourceItem("team/stale.json", "d9", "h9"),
	}}

	cfg := converge.WithContainers(plan.FolderConfig(repoName))
	desired, observed := plan.Declare(tree, nil), mustObserve(list)

	full, err := converge.NewPlan(desired, observed, cfg)
	require.NoError(t, err)

	// Complete=false: the hint source cannot guarantee the window.
	fallback, err := converge.NewPlan(desired, observed, cfg,
		converge.WithHints(plan.Hints(nil, false)))
	require.NoError(t, err)

	require.Equal(t, converge.ModeFull, fallback.Mode)
	require.Equal(t, full.String(), fallback.String())
}
