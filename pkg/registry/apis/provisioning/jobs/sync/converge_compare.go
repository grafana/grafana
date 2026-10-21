package sync

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/plan"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// UseConverge routes Compare and applyChanges through the converge planner
// instead of the hand-rolled diff.
//
// It defaults on, so the planner is what the suites exercise. Set
// PROVISIONING_CONVERGE=0 to run the hand-rolled diff instead and diff the two.
// It exists for that comparison and is not a product setting: one of the two
// implementations has to go before this ships.
var UseConverge = os.Getenv("PROVISIONING_CONVERGE") != "0"

// CompareViaConverge is Compare implemented on the converge planner.
//
// The shape of the work is the same — read the tree, list what Grafana holds,
// resolve folder metadata, diff — but the diff, the ordering, the re-parenting
// and the orphan cleanup come from the planner, and the result is translated
// back into the ResourceFileChange list the apply path already consumes.
func CompareViaConverge(
	ctx context.Context,
	repo repository.Reader,
	repositoryResources resources.RepositoryResources,
	ref string,
	folderMetadataEnabled bool,
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
	metadata, invalid, err := readFolderMetadata(ctx, repo, ref, source, folderMetadataEnabled)
	if err != nil {
		return nil, nil, nil, err
	}

	observed, unaddressable := plan.Observe(target)
	p, err := converge.NewPlan(
		plan.Declare(source, metadata),
		observed,
		converge.WithContainers(plan.FolderConfig(repo.Config().GetName())),
	)
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
func readFolderMetadata(
	ctx context.Context,
	repo repository.Reader,
	ref string,
	source []repository.FileTreeEntry,
	enabled bool,
) (map[string]plan.FolderMetadata, []*resources.InvalidFolderMetadata, error) {
	if !enabled {
		return nil, nil, nil
	}

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
	byIdentity := make(map[string]*provisioning.ResourceListItem, len(target.Items))
	// Folders are also indexed by path. A container taking a new identity is
	// ensured under the new one, so looking the old folder up by identity
	// finds nothing — and without it the change is not recognisable as a
	// rename, which is what pays for the new folder at the quota limit.
	foldersByPath := make(map[string]*provisioning.ResourceListItem)
	for i := range target.Items {
		item := &target.Items[i]
		byIdentity[item.Name] = item
		if item.Resource == resources.FolderResource.Resource && item.Path != "" {
			foldersByPath[safepath.EnsureTrailingSlash(item.Path)] = item
		}
	}

	out := make([]ResourceFileChange, 0, len(p.Ops)+len(p.Exclusions))

	for _, op := range p.Ops {
		c := ResourceFileChange{Path: string(op.Key), Hash: string(op.Fingerprint)}
		if existing, ok := byIdentity[string(op.Identity)]; ok {
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
				if existing, ok := byIdentity[string(op.Identity)]; ok {
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
		// The folder is implied; the resource inside it is what the user
		// declared and what they need named. Reporting both would make the
		// job output longer without telling anyone anything new.
		if safepath.IsDir(string(e.Key)) {
			continue
		}
		path := string(e.Key)
		logger.Debug("unsupported path declared", "path", path)
		out = append(out, ResourceFileChange{
			Action:  repository.FileActionIgnored,
			Path:    path,
			Warning: &resources.UnsupportedPathError{Path: path, Err: resources.IsPathSupported(path)},
		})
	}

	return out
}
