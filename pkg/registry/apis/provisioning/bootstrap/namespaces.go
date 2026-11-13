package bootstrap

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
)

// OrgNamespaces lists the namespaces a bootstrap repository is registered in.
type OrgNamespaces func(ctx context.Context) ([]string, error)

// OrgNamespaceLister lists one namespace per org, deduplicated: a namespace mapper can map
// several orgs onto the same namespace, and that namespace holds one repository either way.
func OrgNamespaceLister(namespacer request.NamespaceMapper, orgSvc org.Service) OrgNamespaces {
	return func(ctx context.Context) ([]string, error) {
		orgs, err := orgSvc.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return nil, err
		}

		seen := make(map[string]struct{}, len(orgs))
		out := make([]string, 0, len(orgs))
		for _, o := range orgs {
			ns := namespacer(o.ID)
			if _, ok := seen[ns]; ok {
				continue
			}
			seen[ns] = struct{}{}
			out = append(out, ns)
		}
		return out, nil
	}
}

// Registrar keeps one bootstrap repository per org. Every org reads the same directory, and a
// manifest's own namespace decides which org provisions it.
type Registrar struct {
	// Path is the configured directory. Empty when no bootstrap path is configured, which
	// retires what an earlier run registered.
	Path string
	// DefaultNamespace is the namespace of the default org, which owns every manifest that
	// names no namespace. It is reconciled even when the org has no record of its own.
	DefaultNamespace string
	// Orgs lists the namespaces to keep a repository in.
	Orgs OrgNamespaces
	// Existing lists the repositories in every namespace. Optional: without it a repository
	// whose org was deleted is never retired, since a deleted org never appears in Orgs
	// again and org deletion does not remove provisioning repositories.
	Existing func(ctx context.Context) ([]provisioning.Repository, error)
}

// Reconcilable reports whether this registrar can reconcile.
func (r Registrar) Reconcilable() bool {
	return r.Orgs != nil && r.DefaultNamespace != ""
}

// Reconcile registers the bootstrap repository in every org, removes it from every org once
// the path is cleared, and retires one whose org is gone. Orgs are reconciled independently:
// one failure leaves the rest registered.
func (r Registrar) Reconcile(ctx context.Context, repos func(namespace string) Repositories) error {
	namespaces, err := r.Orgs(ctx)
	if err != nil {
		return fmt.Errorf("list org namespaces: %w", err)
	}
	// auto_assign_org_id can name an org with no record, and bootstrap_path provisions it.
	if !slices.Contains(namespaces, r.DefaultNamespace) {
		namespaces = append(namespaces, r.DefaultNamespace)
	}

	var errs []error
	for _, ns := range namespaces {
		cfg := Config{Path: r.Path, Namespace: ns, DefaultOrg: ns == r.DefaultNamespace}
		if err := Reconcile(ctx, repos(ns), cfg); err != nil {
			errs = append(errs, fmt.Errorf("namespace %s: %w", ns, err))
		}
	}

	orphans, err := r.orphans(ctx, namespaces)
	if err != nil {
		return errors.Join(append(errs, err)...)
	}
	for _, ns := range orphans {
		// An empty path is what retires it, along with everything it provisioned.
		if err := Reconcile(ctx, repos(ns), Config{Namespace: ns}); err != nil {
			errs = append(errs, fmt.Errorf("orphan namespace %s: %w", ns, err))
		}
	}
	return errors.Join(errs...)
}

// orphans lists the namespaces holding a bootstrap repository whose org no longer exists.
// Deleting an org leaves the repository behind -- org deletion does not cover provisioning
// resources -- and a namespace missing from live is never reconciled again, so the sync it
// still schedules would run forever against an org nobody can reach.
func (r Registrar) orphans(ctx context.Context, live []string) ([]string, error) {
	if r.Existing == nil {
		return nil, nil
	}
	repositories, err := r.Existing(ctx)
	if err != nil {
		return nil, fmt.Errorf("list repositories: %w", err)
	}

	var out []string
	for i := range repositories {
		repo := &repositories[i]
		if repo.Name != Name || !owned(repo) || slices.Contains(live, repo.Namespace) {
			continue
		}
		out = append(out, repo.Namespace)
	}
	return out, nil
}

// Run reconciles on every tick until ctx is done, so an org created after startup gets its
// own repository. There is no org-created event to subscribe to. The first reconcile is the
// caller's, so the repositories exist before the API serves its first request.
//
// With no path configured there is nothing to keep registered, only an earlier run's
// repositories to retire, so Run stops after one clean pass: an org created later cannot hold
// a repository that nothing created.
func (r Registrar) Run(ctx context.Context, repos func(namespace string) Repositories, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := r.Reconcile(ctx, repos); err != nil {
				logging.FromContext(ctx).Error("failed to reconcile bootstrap repositories",
					"path", r.Path, "error", err)
				continue
			}
			if r.Path == "" {
				return
			}
		}
	}
}
