package resources

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/converge"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// useConverge routes the write path through a plan before it writes anything.
//
// It is set once from the provisioningConvergePlanner feature toggle, at the
// same wiring that chooses the sync's diff, so the interactive path and the
// convergence path are never on different sides of the switch — a write the API
// accepted under one and the sync deletes under the other is the exact
// divergence this is meant to remove.
var useConverge bool

// SetConvergePreflight installs the plan-based write preflight. It is called
// once during wiring from the resolved feature toggle.
func SetConvergePreflight(enabled bool) { useConverge = enabled }

// preflight decides, before anything is written, what a single write would do
// and whether it is allowed.
//
// Today the decisions are spread through the write: the path is validated when
// the resource is parsed, the resource is authorised next, and the folders the
// write needs are created afterwards — so a write can be refused after its
// folder already exists, and a path the sync would refuse can still be
// accepted here. Planning first collapses all three into one question asked
// once.
func (r *DualReadWriter) preflight(ctx context.Context, path, ref string, isDir bool) error {
	if !useConverge {
		return nil
	}

	key := converge.Key(path)
	if isDir {
		key = key.AsContainer()
	}

	desired := []converge.Declaration{declarationFor(path, isDir)}
	for _, a := range key.Ancestors() {
		desired = append(desired, converge.Declaration{Key: a, Container: true})
	}

	observed, canObserve, err := r.observeAncestors(ctx, key, ref)
	if err != nil {
		return err // transient: not a refusal
	}

	p, err := converge.NewPlan(desired, observed,
		converge.WithContainers(converge.ContainerConfig{
			Implied: true,
			FallbackIdentity: func(k converge.Key) converge.Identity {
				return converge.Identity(ParseFolder(string(k), r.repo.Config().GetName()).ID)
			},
		}),
		converge.WithHints(converge.HintSet{Keys: []converge.Key{key}, Complete: true}),
		converge.WithExclusionScope(converge.ScopeTargeted),
	)
	if err != nil {
		return fmt.Errorf("plan write: %w", err)
	}

	// A key the sync would refuse is refused here too, with the same reason.
	// Two implementations of that rule is how an API comes to accept a write
	// that the next sync deletes.
	for _, e := range p.Exclusions {
		if e.Key == key {
			return &UnsupportedPathError{Path: path, Err: IsPathSupported(path)}
		}
	}

	// Without a reliable view of which folders exist, the plan cannot say
	// which ones this write has to create — and demanding create permission
	// for folders that are already there fails writes on access they never
	// needed. The path refusal above still stands; the folder authorisation
	// does not get to guess.
	if !canObserve {
		return nil
	}

	// Every folder the write implies is authorised before any of them exists.
	for _, op := range p.Ops {
		if op.Kind != converge.OpEnsureContainer {
			continue
		}
		folderPath := safepath.EnsureTrailingSlash(string(op.Key))
		if err := r.authorizer.AuthorizeCreateFolder(ctx, folderPath); err != nil {
			return fmt.Errorf("authorize create folder %s: %w", folderPath, err)
		}
	}
	return nil
}

// declarationFor classifies one path exactly as the sync classifies a tree
// entry: the shared decision, not a second opinion.
func declarationFor(path string, isDir bool) converge.Declaration {
	if isDir {
		return converge.Declaration{Key: converge.Key(path).AsContainer(), Container: true}
	}
	d := converge.Declaration{Key: converge.Key(path)}
	if IsPathSupported(path) == nil {
		return d
	}
	if safepath.IsHidden(path) || !HasResourceExtension(path) {
		d.Verdict = converge.Ignored
		return d
	}
	d.Verdict = converge.Excluded
	d.Reason = converge.Reason("provisioning/unsupported-path")
	return d
}

// observeAncestors reports which of the key's ancestor folders Grafana already
// holds, so the plan only ensures the ones that are genuinely missing — and so
// a write into a folder that already exists does not ask anyone for permission
// to create it.
//
// Each directory is resolved on its own. FindExistingAncestor returns only the
// nearest existing folder's identity, not the path it was found at, so there is
// no way to tell from it which ancestors exist: a pinned UID on "a/" with "a/b/"
// missing would have "a/b/" reported as present and its required ensure — and
// its authorisation — dropped.
func (r *DualReadWriter) observeAncestors(ctx context.Context, key converge.Key, ref string) ([]converge.Observation, bool, error) {
	if r.folders == nil || r.folders.Client() == nil {
		return nil, false, nil
	}

	// Existence is read with the provisioning identity, as FindExistingAncestor
	// does. The caller's permission to *create* a folder is still checked with
	// the caller's identity below; requiring folders:get on every ancestor as
	// well would fail a write the caller is authorised to make — access granted
	// on the resource itself does not imply it on the folders above it.
	lookupCtx, _, err := identity.WithProvisioningIdentity(ctx, r.repo.Config().GetNamespace())
	if err != nil {
		return nil, false, fmt.Errorf("identity for ancestor lookup: %w", err)
	}

	var out []converge.Observation
	for _, a := range key.Ancestors() {
		id, err := r.ancestorIdentity(lookupCtx, a, ref)
		if err != nil {
			if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
				continue
			}
			// Malformed ancestor metadata is not a reason to refuse a write
			// below it: folder application falls back to the held or derived
			// identity and keeps the ancestor, so refusing here would reject
			// writes the write path itself accepts. Treated as unobservable —
			// the path refusal still stands, the folder authorisation does not
			// get to guess.
			if invalid, ok := errors.AsType[*InvalidFolderMetadata](err); ok {
				_ = invalid
				return nil, false, nil
			}
			return nil, false, fmt.Errorf("resolve identity of %s: %w", a, err)
		}
		if _, err := r.folders.GetFolder(lookupCtx, id); err != nil {
			if apierrors.IsNotFound(err) {
				continue // the write has to create it, and ask to
			}
			return nil, false, fmt.Errorf("look up folder %s: %w", a, err)
		}
		out = append(out, converge.Observation{Key: a, Identity: converge.Identity(id), Container: true})
	}
	return out, true, nil
}

// ancestorIdentity resolves what a directory's folder identity would be,
// falling back to the configured branch when the requested ref does not exist
// yet — the first nested write to a new pull-request branch, where the
// _folder.json is only committed on the configured branch. The parser already
// does this; refusing here would block the very write that creates the branch.
func (r *DualReadWriter) ancestorIdentity(ctx context.Context, dir converge.Key, ref string) (string, error) {
	id, err := GetFolderID(ctx, r.repo, string(dir), ref, r.folderMetadataEnabled)
	if err == nil {
		return id, nil
	}
	if ref != "" && errors.Is(err, repository.ErrRefNotFound) {
		return GetFolderID(ctx, r.repo, string(dir), "", r.folderMetadataEnabled)
	}
	return "", err
}
