package plan_test

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/plan"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// These tests run the existing diff and the converge plan over the same inputs
// and compare the state each would leave behind. They are the evidence for the
// migration: where the two agree, converge is a drop-in; where they differ, the
// difference is a decision someone has to make before it ships.

const repoName = "test-repo"

func mustObserve(list *provisioning.ResourceList) []converge.Observation {
	obs, _ := plan.Observe(list)
	return obs
}

func blob(path, hash string) repository.FileTreeEntry {
	return repository.FileTreeEntry{Path: path, Hash: hash, Blob: true}
}

func dir(path string) repository.FileTreeEntry {
	return repository.FileTreeEntry{Path: path, Blob: false}
}

func resourceItem(path, name, hash string) provisioning.ResourceListItem {
	return provisioning.ResourceListItem{
		Path: path, Name: name, Hash: hash,
		Group: "dashboard.grafana.app", Resource: "dashboards",
	}
}

// folderItem is a managed folder as Grafana actually holds one: its name is
// the identity derived from the path and the repository, which is what sync
// assigns when no _folder.json pins a UID. Using an arbitrary name here would
// make every run look like a re-identification.
func folderItem(path, hash string) provisioning.ResourceListItem {
	return provisioning.ResourceListItem{
		Path: path, Name: resources.ParseFolder(path, repoName).ID, Hash: hash,
		Group: resources.FolderResource.Group, Resource: resources.FolderResource.Resource,
	}
}

// endState is what the target holds after a diff is applied: path to content.
// Folders are tracked separately because their identity, not their content, is
// what matters.
type endState struct {
	entities map[string]string
	folders  map[string]bool
}

func (e endState) String() string {
	lines := make([]string, 0, len(e.entities)+len(e.folders))
	for k, v := range e.entities {
		lines = append(lines, "entity "+k+"="+v)
	}
	for k := range e.folders {
		lines = append(lines, "folder "+k)
	}
	sort.Strings(lines)
	return strings.Join(lines, "\n")
}

// applyLegacy reduces the existing ResourceFileChange list to an end state.
func applyLegacy(start endState, changes []sync.ResourceFileChange, tree []repository.FileTreeEntry) endState {
	hashes := map[string]string{}
	for _, e := range tree {
		hashes[e.Path] = e.Hash
	}

	out := endState{entities: map[string]string{}, folders: map[string]bool{}}
	for k, v := range start.entities {
		out.entities[k] = v
	}
	for k := range start.folders {
		out.folders[k] = true
	}

	for _, c := range changes {
		isFolder := strings.HasSuffix(c.Path, "/")
		switch c.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			if isFolder {
				out.folders[c.Path] = true
			} else {
				out.entities[c.Path] = hashes[c.Path]
			}
		case repository.FileActionDeleted:
			if isFolder {
				delete(out.folders, c.Path)
			} else {
				delete(out.entities, c.Path)
			}
		case repository.FileActionRenamed:
			if c.Existing != nil {
				delete(out.entities, c.Existing.Path)
			}
			out.entities[c.Path] = hashes[c.Path]
		case repository.FileActionIgnored:
			// Counted towards the job total, changes nothing.
		}
	}
	return out
}

// applyPlan reduces a converge plan to an end state.
func applyPlan(start endState, p *converge.Plan) endState {
	out := endState{entities: map[string]string{}, folders: map[string]bool{}}
	for k, v := range start.entities {
		out.entities[k] = v
	}
	for k := range start.folders {
		out.folders[k] = true
	}

	for _, op := range p.Ops {
		key := string(op.Key)
		switch op.Kind {
		case converge.OpCreate, converge.OpUpdate:
			out.entities[key] = string(op.Fingerprint)
		case converge.OpDelete:
			delete(out.entities, key)
		case converge.OpMove:
			delete(out.entities, string(op.From))
			out.entities[key] = string(op.Fingerprint)
		case converge.OpEnsureContainer:
			out.folders[key] = true
		case converge.OpRemoveContainer:
			delete(out.folders, key)
		}
	}
	return out
}

func startFrom(list *provisioning.ResourceList) endState {
	out := endState{entities: map[string]string{}, folders: map[string]bool{}}
	for _, item := range list.Items {
		if item.Path == "" {
			continue
		}
		if item.Resource == resources.FolderResource.Resource {
			out.folders[strings.TrimSuffix(item.Path, "/")+"/"] = true
			continue
		}
		out.entities[item.Path] = item.Hash
	}
	return out
}

func runBoth(t *testing.T, tree []repository.FileTreeEntry, items []provisioning.ResourceListItem) (legacy, next endState, p *converge.Plan) {
	t.Helper()
	ctx := context.Background()
	list := &provisioning.ResourceList{Items: items}

	// Folder metadata is resolved by the caller on both paths; here every
	// _folder.json is valid and pins a UID derived from its path.
	metadata := map[string]plan.FolderMetadata{}
	for _, e := range tree {
		if e.Blob && resources.IsFolderMetadataFile(e.Path) {
			d := strings.TrimSuffix(e.Path, "_folder.json")
			metadata[d] = plan.FolderMetadata{UID: "pinned-" + strings.ReplaceAll(d, "/", "-"), Valid: true}
		}
	}

	legacyChanges, err := sync.Changes(ctx, tree, list, true)
	require.NoError(t, err)
	legacyChanges = sync.DetectRenames(legacyChanges)

	p, err = converge.NewPlan(
		plan.Declare(tree, metadata),
		mustObserve(list),
		converge.WithContainers(plan.FolderConfig(repoName)),
	)
	require.NoError(t, err)

	start := startFrom(list)
	return applyLegacy(start, legacyChanges, tree), applyPlan(start, p), p
}

func TestEquivalence(t *testing.T) {
	tests := []struct {
		name  string
		tree  []repository.FileTreeEntry
		items []provisioning.ResourceListItem
	}{
		{
			name: "unchanged repository produces no change on either path",
			tree: []repository.FileTreeEntry{dir("team/"), blob("team/one.json", "h1")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/one.json", "d1", "h1"),
			},
		},
		{
			name: "new file is created",
			tree: []repository.FileTreeEntry{dir("team/"), blob("team/one.json", "h1"), blob("team/two.json", "h2")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/one.json", "d1", "h1"),
			},
		},
		{
			name: "changed file is updated",
			tree: []repository.FileTreeEntry{dir("team/"), blob("team/one.json", "h1-new")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/one.json", "d1", "h1"),
			},
		},
		{
			name: "file removed from the repository is deleted",
			tree: []repository.FileTreeEntry{dir("team/"), blob("team/one.json", "h1")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/one.json", "d1", "h1"),
				resourceItem("team/gone.json", "d2", "h2"),
			},
		},
		{
			name: "renamed file keeps its content",
			tree: []repository.FileTreeEntry{dir("team/"), blob("team/renamed.json", "h1")},
			items: []provisioning.ResourceListItem{
				folderItem("team/", ""),
				resourceItem("team/one.json", "d1", "h1"),
			},
		},
		{
			name: "nested folders are created for a new deep file",
			tree: []repository.FileTreeEntry{dir("a/"), dir("a/b/"), blob("a/b/c.json", "h1")},
		},
		{
			name: "non-resource files are invisible",
			tree: []repository.FileTreeEntry{
				dir("team/"), blob("team/README.md", "r1"), blob("team/logo.png", "p1"),
				blob("team/.keep", "k1"), blob("team/one.json", "h1"),
			},
			items: []provisioning.ResourceListItem{folderItem("team/", "")},
		},
		{
			name:  "file at an unaddressable path is not held",
			tree:  []repository.FileTreeEntry{dir("team/"), blob("team/Backend & UI.json", "h1")},
			items: []provisioning.ResourceListItem{folderItem("team/", "")},
		},
		{
			name: "whole repository emptied",
			tree: nil,
			items: []provisioning.ResourceListItem{
				folderItem("a/", ""), folderItem("a/b/", ""),
				resourceItem("a/b/c.json", "d1", "h1"), resourceItem("a/d.json", "d2", "h2"),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			legacy, next, p := runBoth(t, tt.tree, tt.items)
			require.Equal(t, legacy.String(), next.String(),
				"the two diffs leave different state\nplan:\n%s", p)
		})
	}
}

// The case the convergent-sync contract exists to settle. The legacy full diff
// deletes the dashboard silently; converge deletes it and says why.
func TestUnaddressablePathIsReported(t *testing.T) {
	tree := []repository.FileTreeEntry{dir("team/"), blob("team/Backend & UI.json", "h1")}
	items := []provisioning.ResourceListItem{
		folderItem("team/", ""),
		resourceItem("team/dashboard.json", "d1", "h1"),
	}

	legacy, next, p := runBoth(t, tree, items)
	require.Equal(t, legacy.String(), next.String(), "both remove the dashboard")

	reported := make([]string, 0, len(p.Exclusions))
	for _, e := range p.Exclusions {
		reported = append(reported, fmt.Sprintf("%s (%s)", e.Key, e.Reason))
	}
	require.Equal(t, []string{"team/Backend & UI.json (provisioning/unsupported-path)"}, reported)
}
