package plan_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/plan"
)

type checker struct {
	deny map[string]bool
	seen []plan.Permission
}

func (c *checker) Check(_ context.Context, p plan.Permission) error {
	c.seen = append(c.seen, p)
	if c.deny[p.Path] {
		return errors.New("forbidden")
	}
	return nil
}

func refuseUntrusted(_ context.Context, folderPath string) (string, error) {
	return "", errors.New("must not be called: " + folderPath)
}

// A write into an existing folder is one operation, authorised against the
// folder identity the target actually holds.
func TestFilesWriteIntoExistingFolder(t *testing.T) {
	nearby := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{
		folderItem("team/", ""),
	}}

	p, err := plan.Targeted(repoName, plan.Write{Path: "team/new.json", Hash: "h9"}, nearby)
	require.NoError(t, err)
	require.Len(t, p.Ops, 1, "plan:\n%s", p)
	require.Equal(t, converge.OpCreate, p.Ops[0].Kind)

	c := &checker{}
	vetoes, err := plan.Vetoes(context.Background(), p, c, refuseUntrusted)
	require.NoError(t, err)
	require.Empty(t, vetoes)

	// The folder identity came from the target, so no fallback resolution was
	// needed — refuseUntrusted would have failed the test otherwise.
	require.Equal(t, []plan.Permission{{
		Verb:   "create",
		Folder: folderItem("team/", "").Name,
		Path:   "team/new.json",
	}}, c.seen)
}

// A write into a folder that does not exist yet also plans the folder, and the
// authorisation pass sees both. Today the folder is created inside the write
// path, so a denial can arrive after the folder already exists.
func TestFilesWriteCreatesTheFolderItNeeds(t *testing.T) {
	p, err := plan.Targeted(repoName, plan.Write{Path: "new/deep/one.json", Hash: "h1"}, nil)
	require.NoError(t, err)

	kinds := make([]string, 0, len(p.Ops))
	for _, op := range p.Ops {
		kinds = append(kinds, op.Kind.String()+" "+string(op.Key))
	}
	require.Equal(t, []string{
		"ensure-container new/",
		"ensure-container new/deep/",
		"create new/deep/one.json",
	}, kinds)

	// Denying the deepest folder must deny the write too: a resource cannot be
	// parented to a folder that will not exist.
	c := &checker{deny: map[string]bool{"new/deep/": true}}
	resolved := func(_ context.Context, path string) (string, error) { return "resolved:" + path, nil }
	vetoes, err := plan.Vetoes(context.Background(), p, c, resolved)
	require.NoError(t, err)
	require.Len(t, vetoes, 1)

	restricted, err := converge.Restrict(p, vetoes)
	require.NoError(t, err)

	left := make([]string, 0, len(restricted.Ops))
	for _, op := range restricted.Ops {
		left = append(left, op.Kind.String()+" "+string(op.Key))
	}
	require.Equal(t, []string{"ensure-container new/"}, left,
		"the write and the folder under the denial must both be gone")
}

// The write path refuses the same keys the convergence path refuses, with the
// same reason. Two implementations of that rule is how an API comes to accept
// a write that the next sync deletes.
func TestFilesRefusesWhatSyncWouldRefuse(t *testing.T) {
	nearby := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{folderItem("team/", "")}}

	p, err := plan.Targeted(repoName, plan.Write{Path: "team/Backend & UI.json", Hash: "h1"}, nearby)
	require.NoError(t, err)

	reason, rejected := plan.Rejected(p, "team/Backend & UI.json")
	require.True(t, rejected)
	require.Equal(t, plan.ReasonUnsupportedPath, reason)
	require.Empty(t, p.Ops, "nothing is written at a key Grafana cannot address")
}

// An identity the request implied rather than one the target holds must be
// re-resolved from trusted state before it is authorised against. A branch can
// claim any folder UID it likes.
func TestFilesAuthorizesAgainstTrustedIdentity(t *testing.T) {
	p, err := plan.Targeted(repoName, plan.Write{Path: "unsynced/one.json", Hash: "h1"}, nil)
	require.NoError(t, err)

	var create converge.Op
	for _, op := range p.Ops {
		if op.Kind == converge.OpCreate {
			create = op
		}
	}
	require.False(t, create.ContainerProvenance.Trusted(),
		"a folder this plan is creating has no identity in the target yet")

	var resolvedFor []string
	resolve := func(_ context.Context, path string) (string, error) {
		resolvedFor = append(resolvedFor, path)
		return "trusted-" + path, nil
	}
	c := &checker{}
	_, err = plan.Vetoes(context.Background(), p, c, resolve)
	require.NoError(t, err)
	require.Contains(t, resolvedFor, "unsynced/")

	for _, seen := range c.seen {
		if seen.Path == "unsynced/one.json" {
			require.Equal(t, "trusted-unsynced/", seen.Folder)
		}
	}
}

// A transient failure during authorisation aborts the run. Turning it into a
// veto would tell the user they lack a permission they have, and for a
// deletion would silently keep a resource nothing declares.
func TestFilesTransientAuthFailureAbortsRatherThanDenies(t *testing.T) {
	nearby := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{folderItem("team/", "")}}
	p, err := plan.Targeted(repoName, plan.Write{Path: "team/one.json", Hash: "h1"}, nearby)
	require.NoError(t, err)

	boom := errors.New("zanzana unavailable")
	_, err = plan.Vetoes(context.Background(), p, transientChecker{boom}, refuseUntrusted)
	require.ErrorIs(t, err, boom)
}

type transientChecker struct{ err error }

func (t transientChecker) Check(context.Context, plan.Permission) error {
	return &plan.TransientError{Err: t.err}
}

// Deleting a file is one operation and does not touch the folder it was in.
func TestFilesDelete(t *testing.T) {
	nearby := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{
		folderItem("team/", ""),
		resourceItem("team/one.json", "d1", "h1"),
	}}

	p, err := plan.Targeted(repoName, plan.Write{Path: "team/one.json", Delete: true}, nearby)
	require.NoError(t, err)
	require.Len(t, p.Ops, 1, "plan:\n%s", p)
	require.Equal(t, converge.OpDelete, p.Ops[0].Kind)
	// The identity carries the kind, because a name alone is not unique across
	// kinds; the target's own name is recovered with ResourceName.
	require.Equal(t, "d1", plan.ResourceName(p.Ops[0].Identity))
}

// A folder metadata edit asks the checker for update permission, not create:
// an ensure is also how an existing container is re-asserted, and asking for
// create can refuse a change the caller is allowed to make.
func TestFilesFolderContentEditAsksForUpdate(t *testing.T) {
	nearby := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{folderItem("team/", "m1")}}

	p, err := plan.Targeted(repoName, plan.Write{Path: "team/", Hash: "m2", Folder: true}, nearby)
	require.NoError(t, err)
	require.NotEmpty(t, p.Ops, "the metadata change is the write that was asked for")

	c := &checker{}
	_, err = plan.Vetoes(context.Background(), p, c, refuseUntrusted)
	require.NoError(t, err)
	require.NotEmpty(t, c.seen)
	for _, seen := range c.seen {
		require.Equal(t, "update", seen.Verb, "re-asserting an existing folder is an update")
	}
}

// Deleting an unsynced file must not plan folder creation, nor ask for
// permission to create a folder, in order to remove something that is not there.
func TestFilesDeleteDoesNotPlanItsAncestors(t *testing.T) {
	p, err := plan.Targeted(repoName, plan.Write{Path: "missing/one.json", Delete: true}, nil)
	require.NoError(t, err)
	for _, op := range p.Ops {
		require.NotEqual(t, converge.OpEnsureContainer, op.Kind,
			"a delete needs no path: %s %s", op.Kind, op.Key)
	}
}

// Deleting a folder is checked in its parent's context, like every other
// delete. A container removal carries no identity for its parent and the zero
// provenance reads as trusted, so an unresolved parent was checked as the root
// — asking for permission in a folder the request is not in.
func TestFilesNestedFolderDeleteIsCheckedInItsParent(t *testing.T) {
	nearby := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{
		folderItem("team/", ""),
		folderItem("team/sub/", ""),
	}}

	p, err := plan.Targeted(repoName, plan.Write{Path: "team/sub/", Delete: true}, nearby)
	require.NoError(t, err)
	require.Len(t, p.Ops, 1, "plan:\n%s", p)
	require.Equal(t, converge.OpRemoveContainer, p.Ops[0].Kind)

	c := &checker{}
	resolved := func(_ context.Context, path string) (string, error) { return "resolved:" + path, nil }
	vetoes, err := plan.Vetoes(context.Background(), p, c, resolved)
	require.NoError(t, err)
	require.Empty(t, vetoes)

	require.Equal(t, []plan.Permission{{
		Verb:     "delete",
		Folder:   "resolved:team/",
		Path:     "team/sub/",
		IsFolder: true,
	}}, c.seen)
}
