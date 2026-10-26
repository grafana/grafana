package sync

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/plan"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// CompareViaConverge is Compare implemented on the converge planner.
//
// The shape of the work is the same — read the tree, list what Grafana holds,
// resolve folder metadata, diff — but the diff, the ordering, the re-parenting
// and the orphan cleanup come from the planner, and the result is translated
// back into the ResourceFileChange list the apply path already consumes.
//
// The unused bool keeps the CompareFn signature; folder metadata is always read.
func CompareViaConverge(
	ctx context.Context,
	repo repository.Reader,
	repositoryResources resources.RepositoryResources,
	ref string,
	_ bool,
) ([]ResourceFileChange, []string, []*resources.InvalidFolderMetadata, error) {
	return compareViaConverge(ctx, repo, repositoryResources, ref, converge.HintSet{})
}

func compareViaConverge(
	ctx context.Context,
	repo repository.Reader,
	repositoryResources resources.RepositoryResources,
	ref string,
	hints converge.HintSet,
) ([]ResourceFileChange, []string, []*resources.InvalidFolderMetadata, error) {
	target, err := repositoryResources.List(ctx)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("error listing current: %w", err)
	}

	source, err := repo.ReadTree(ctx, ref)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("error reading tree: %w", err)
	}

	// Folder identities are resolved here, by the caller, because the planner
	// performs no I/O. This is also the only place a _folder.json is read, as
	// against the several reads the augmentation passes make today.
	metadata, invalid, err := readFolderMetadata(ctx, repo, ref, source)
	if err != nil {
		return nil, nil, nil, err
	}
	// An unusable claim falls back to the identity Grafana already has, which
	// only the observed list knows.
	for i := range target.Items {
		item := &target.Items[i]
		if item.Resource != resources.FolderResource.Resource || item.Path == "" {
			continue
		}
		dir := safepath.EnsureTrailingSlash(item.Path)
		if md, ok := metadata[dir]; ok && !md.Valid {
			md.Held = item.Name
			metadata[dir] = md
		}
	}

	observed, unaddressable := plan.Observe(target)
	opts := []converge.Option{
		converge.WithContainers(plan.FolderConfig(repo.Config().GetName())),
	}
	if hints.Complete {
		opts = append(opts, converge.WithHints(hints))
	}
	p, err := converge.NewPlan(plan.Declare(source, metadata), observed, opts...)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("calculate changes: %w", err)
	}

	changes := translatePlan(ctx, p, target, metadata)

	// The warning names what happened to the folder, which is only knowable
	// once the plan exists: a folder being created and one being left alone
	// read very differently to whoever has to fix the metadata.
	invalid = attachActions(invalid, changes)
	for _, u := range unaddressable {
		logging.FromContext(ctx).Warn("managed resource has no source path",
			"group", u.Group, "resource", u.Resource, "name", u.Name)
		changes = append(changes, ResourceFileChange{
			Action:  repository.FileActionIgnored,
			Warning: fmt.Errorf("managed %s/%s %q has no source path and cannot be reconciled", u.Group, u.Resource, u.Name),
		})
	}

	if len(changes) > 0 {
		repositoryResources.SetTree(resources.NewFolderTreeFromResourceList(target))
	}

	return changes, resources.FindFoldersMissingMetadata(source), invalid, nil
}

// readFolderMetadata resolves every folder's pinned identity up front. A
// _folder.json that cannot be parsed leaves the folder's identity undecidable,
// which is permanent given this content: the folder is reported and nothing is
// written into it.
//
// Metadata is read unconditionally, matching the actuator: a planner that
// skipped it would compare against identities the ensure does not write.
func readFolderMetadata(
	ctx context.Context,
	repo repository.Reader,
	ref string,
	source []repository.FileTreeEntry,
) (map[string]plan.FolderMetadata, []*resources.InvalidFolderMetadata, error) {
	out := make(map[string]plan.FolderMetadata)
	var invalid []*resources.InvalidFolderMetadata

	for _, entry := range source {
		if !entry.Blob || !resources.IsFolderMetadataFile(entry.Path) {
			continue
		}
		dir := safepath.EnsureTrailingSlash(safepath.Dir(entry.Path))
		if dir == "" {
			continue
		}

		folder, _, err := resources.ReadFolderMetadata(ctx, repo, dir, ref)
		switch {
		case err == nil:
			out[dir] = plan.FolderMetadata{UID: folder.GetName(), Valid: true}
		case errors.Is(err, repository.ErrFileNotFound), apierrors.IsNotFound(err):
			// Nothing pins an identity, so the derived one applies.
		default:
			if invalidErr, ok := errors.AsType[*resources.InvalidFolderMetadata](err); ok {
				logging.FromContext(ctx).Info("invalid folder metadata", "path", dir, "error", err)
				invalid = append(invalid, invalidErr)
				out[dir] = plan.FolderMetadata{Valid: false}
				continue
			}
			return nil, nil, fmt.Errorf("read folder metadata for %s: %w", dir, err)
		}
	}
	return out, invalid, nil
}

// observedIdentityOf mirrors the identity plan.Observe assigns, so the index
// and the plan agree on what names a row. A bare resource name does not: two
// kinds can share a path and a name, and the index would hand both deletions
// the same row.
func observedIdentityOf(item *provisioning.ResourceListItem) string {
	if isFolderItem(item) {
		return item.Name
	}
	return item.Group + "/" + item.Resource + "/" + item.Name
}

// indexKey normalises a path so that the two sides agree: a folder is keyed by
// its path with a trailing slash, an entity by its path as given.
func indexKey(path string, container bool) string {
	if container {
		return safepath.EnsureTrailingSlash(path)
	}
	return path
}

func isFolderItem(item *provisioning.ResourceListItem) bool {
	return item.Resource == resources.FolderResource.Resource
}

// coveredByResourceWarning reports whether some resource inside the directory
// is itself reported, so the directory's warning would only repeat it.
func coveredByResourceWarning(exclusions []converge.Exclusion, dir converge.Key) bool {
	for _, e := range exclusions {
		if e.Reason != plan.ReasonUnsupportedPath {
			continue
		}
		if !safepath.IsDir(string(e.Key)) && e.Key.Within(dir) {
			return true
		}
	}
	return false
}

// attachActions labels each invalid-metadata warning with what the plan does
// to the folder it concerns.
func attachActions(invalid []*resources.InvalidFolderMetadata, changes []ResourceFileChange) []*resources.InvalidFolderMetadata {
	if len(invalid) == 0 {
		return invalid
	}
	actions := make(map[string]repository.FileAction, len(changes))
	for _, c := range changes {
		if safepath.IsDir(c.Path) && c.Action != repository.FileActionIgnored {
			actions[safepath.EnsureTrailingSlash(c.Path)] = c.Action
		}
	}
	out := make([]*resources.InvalidFolderMetadata, 0, len(invalid))
	for _, e := range invalid {
		if action, ok := actions[safepath.EnsureTrailingSlash(e.Path)]; ok {
			e = e.WithAction(action)
		}
		out = append(out, e)
	}
	return out
}

// translatePlan converts a plan into the ResourceFileChange list the apply
// path consumes. The ordering the plan derived is preserved: changes come out
// in stage order, which is what applyChanges spends six buckets rebuilding.
func translatePlan(ctx context.Context, p *converge.Plan, target *provisioning.ResourceList, metadata map[string]plan.FolderMetadata) []ResourceFileChange {
	logger := logging.FromContext(ctx)
	// Keyed by path *and* name: a dashboard and a playlist can both be called
	// "shared" at different paths, and indexing by name alone attaches the
	// wrong row — after which applyChange uses its group and resource to
	// delete or replace the wrong object.
	byKeyIdentity := make(map[string]*provisioning.ResourceListItem, len(target.Items))
	// Folders are also indexed by path. A container taking a new identity is
	// ensured under the new one, so looking the old folder up by identity
	// finds nothing — and without it the change is not recognisable as a
	// rename, which is what pays for the new folder at the quota limit.
	foldersByPath := make(map[string]*provisioning.ResourceListItem)
	for i := range target.Items {
		item := &target.Items[i]
		// Folder keys carry a trailing slash on the plan side, so the index has
		// to agree or every folder relocation loses the row that holds its old
		// path and is mistaken for a fresh create.
		byKeyIdentity[indexKey(item.Path, isFolderItem(item))+"\x00"+observedIdentityOf(item)] = item
		if item.Resource == resources.FolderResource.Resource && item.Path != "" {
			foldersByPath[safepath.EnsureTrailingSlash(item.Path)] = item
		}
	}
	// A move leaves its origin, so that is where its row is.
	lookup := func(op converge.Op) *provisioning.ResourceListItem {
		key := op.Key
		if op.Kind == converge.OpMove && op.From != "" {
			key = op.From
		}
		return byKeyIdentity[indexKey(string(key), key.IsContainer())+"\x00"+string(op.Identity)]
	}

	out := make([]ResourceFileChange, 0, len(p.Ops)+len(p.Exclusions))

	for _, op := range p.Ops {
		c := ResourceFileChange{Path: string(op.Key), Hash: string(op.Fingerprint)}
		if existing := lookup(op); existing != nil {
			c.Existing = existing
		}

		switch op.Kind {
		case converge.OpCreate:
			c.Action = repository.FileActionCreated
		case converge.OpUpdate:
			c.Action = repository.FileActionUpdated
			if op.Reason == converge.ReasonReparent {
				c.Reason = provisioning.ReasonFolderMetadataUpdated
			}
		case converge.OpDelete:
			c.Action = repository.FileActionDeleted
			c.OrphanCleanup = op.Reason == converge.ReasonDuplicate
		case converge.OpMove:
			if op.Key.IsContainer() {
				// A folder that keeps its pinned UID at a new path is a
				// relocation, and the apply path recognises it by shape: an
				// update whose Existing sits at the old path. Translating it
				// as a file rename loses the folder entirely — it is created
				// fresh at the destination and the original is left behind.
				c.Action = repository.FileActionUpdated
				c.Path = safepath.EnsureTrailingSlash(string(op.Key))
				c.Hash = ""
				if existing := lookup(op); existing != nil {
					c.Existing = existing
				}
				break
			}
			c.Action = repository.FileActionRenamed
		case converge.OpEnsureContainer:
			c.Path = safepath.EnsureTrailingSlash(c.Path)
			if op.Reason == converge.ReasonContentChanged || op.Reason == converge.ReasonParentChanged {
				// The folder keeps its own identity: either what the
				// repository says about it changed, or the folder above it
				// took a new one and this folder has to point at it. Neither
				// is a replacement, so it must not be counted as one — a
				// rename is what buys the new folder at the quota limit.
				c.Action = repository.FileActionUpdated
				c.Existing = foldersByPath[c.Path]
				c.Reason = provisioning.ReasonFolderMetadataUpdated
				out = append(out, c)
				continue
			}
			if existing, ok := foldersByPath[c.Path]; ok && existing.Name != string(op.Identity) {
				c.Existing = existing
			}
			if c.Existing != nil {
				c.Action = repository.FileActionUpdated
				c.FolderRenamed = true
				c.Reason = provisioning.ReasonFolderMetadataUpdated
			} else {
				c.Action = repository.FileActionCreated
			}
		case converge.OpRemoveContainer:
			c.Path = safepath.EnsureTrailingSlash(c.Path)
			c.Action = repository.FileActionDeleted
			c.OrphanCleanup = op.Reason != ""
		}
		out = append(out, c)
	}

	// Exclusions are entities the repository declares that Grafana will not
	// hold. They are carried as ignored changes so the job total stays
	// accurate and the reason reaches the user, which is the whole point of
	// distinguishing them from keys that were never resources.
	for _, e := range p.Exclusions {
		if e.Reason == converge.ReasonDuplicateIdentity {
			path := safepath.EnsureTrailingSlash(string(e.Key))
			// Naming the UID is the whole value of the warning: the user has to
			// find the other _folder.json that claims it.
			warning := fmt.Errorf("folder metadata at %s claims a UID already owned by another folder", path)
			if md, ok := metadata[path]; ok && md.UID != "" {
				warning = fmt.Errorf("folder metadata at %s claims UID %q, which is already owned by another folder", path, md.UID)
			}
			out = append(out, ResourceFileChange{
				Action:  repository.FileActionIgnored,
				Path:    path,
				Reason:  provisioning.ReasonFolderMetadataUpdated,
				Warning: warning,
			})
			continue
		}
		if e.Reason != plan.ReasonUnsupportedPath {
			continue
		}
		path := string(e.Key)
		// Where a resource inside the folder is reported too, that is the one
		// the user declared and the folder's own warning adds nothing. Where
		// there is no such resource — a directory holding only metadata, a
		// .keep, or a README — the folder's warning is the only explanation
		// there is, and dropping it leaves a folder missing for no stated
		// reason.
		if safepath.IsDir(path) && coveredByResourceWarning(p.Exclusions, converge.Key(path)) {
			continue
		}
		logger.Debug("unsupported path declared", "path", path)
		out = append(out, ResourceFileChange{
			Action:  repository.FileActionIgnored,
			Path:    path,
			Warning: &resources.UnsupportedPathError{Path: path, Err: resources.IsPathSupported(path)},
		})
	}

	return out
}
