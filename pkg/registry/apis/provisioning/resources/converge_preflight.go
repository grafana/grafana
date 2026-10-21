package resources

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/converge"
)

// useConverge routes the write path through a plan before it writes anything.
// It mirrors the switch in the sync package so both are exercised together;
// it is not a product setting.
var useConverge = os.Getenv("PROVISIONING_CONVERGE") != "0"

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

	observed, err := r.observeAncestors(ctx, key, ref)
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
// The folder tree is only populated during a sync, so it cannot answer this
// for an interactive write; the nearest existing ancestor has to be resolved
// against storage.
func (r *DualReadWriter) observeAncestors(ctx context.Context, key converge.Key, ref string) ([]converge.Observation, error) {
	ancestors := key.Ancestors()
	if len(ancestors) == 0 || r.folders == nil {
		return nil, nil
	}

	deepest := ancestors[len(ancestors)-1]
	id, found, err := r.folders.FindExistingAncestor(ctx, string(deepest), ref)
	if err != nil {
		return nil, fmt.Errorf("resolve existing ancestor of %s: %w", key, err)
	}
	if !found {
		return nil, nil
	}

	// FindExistingAncestor reports the nearest folder that exists. Everything
	// at or above it exists too; everything below it is what the write has to
	// create.
	var out []converge.Observation
	for _, a := range ancestors {
		identity := converge.Identity(ParseFolder(string(a), r.repo.Config().GetName()).ID)
		if string(identity) == id || a == deepest {
			identity = converge.Identity(id)
		}
		out = append(out, converge.Observation{Key: a, Identity: identity, Container: true})
		if string(identity) == id {
			break
		}
	}
	return out, nil
}
