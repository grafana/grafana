package bootstrap

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
)

// OrgNamespaces lists the namespaces a bootstrap repository may be registered in.
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

// Registrar reconciles the bootstrap repository across the instance's orgs. The manifests
// name the org they belong to, so one mounted directory provisions several of them without
// a per-org directory layout.
type Registrar struct {
	// Path is the configured directory, as it is written to the repository's spec. Empty
	// when no bootstrap path is configured, which retires what an earlier run registered.
	Path string
	// Root is Path resolved against the home path: the directory the manifests are read from.
	Root string
	// DefaultNamespace owns every manifest that names no namespace.
	DefaultNamespace string
	// Orgs lists the namespaces that may hold a bootstrap repository.
	Orgs OrgNamespaces
}

// Reconcilable reports whether this registrar can reconcile.
func (r Registrar) Reconcilable() bool {
	return r.Orgs != nil && r.DefaultNamespace != ""
}

// Reconcile registers the bootstrap repository in every org namespace the manifests name and
// removes it from the rest, so a namespace nothing names keeps nothing. Namespaces are
// reconciled independently: one org's failure leaves the others provisioned.
func (r Registrar) Reconcile(ctx context.Context, repos func(namespace string) Repositories) error {
	logger := logging.FromContext(ctx)

	namespaces, err := r.Orgs(ctx)
	if err != nil {
		return fmt.Errorf("list org namespaces: %w", err)
	}
	known := make(map[string]struct{}, len(namespaces)+1)
	for _, ns := range namespaces {
		known[ns] = struct{}{}
	}
	// auto_assign_org_id can name an org with no record, and bootstrap_path provisions it.
	if _, ok := known[r.DefaultNamespace]; !ok {
		known[r.DefaultNamespace] = struct{}{}
		namespaces = append(namespaces, r.DefaultNamespace)
	}

	declared := r.declared(ctx)
	for ns := range declared {
		if _, ok := known[ns]; !ok {
			logger.Error("bootstrap manifests name a namespace that is not an org on this instance; nothing is provisioned for it",
				"namespace", ns, "path", r.Path)
		}
	}

	var errs []error
	for _, ns := range namespaces {
		cfg := Config{Namespace: ns}
		if _, ok := declared[ns]; ok {
			cfg.Path = r.Path
		}
		if err := Reconcile(ctx, repos(ns), cfg); err != nil {
			errs = append(errs, fmt.Errorf("namespace %s: %w", ns, err))
		}
	}
	return errors.Join(errs...)
}

// declared is the set of namespaces to register in: those the manifests name, plus the
// default one, which owns every manifest that names none. An unreadable directory falls back
// to the default namespace alone, so the failure surfaces as that repository's health rather
// than as an instance with nothing registered.
func (r Registrar) declared(ctx context.Context) map[string]struct{} {
	if r.Path == "" {
		return nil
	}
	found, err := DeclaredNamespaces(ctx, r.Root)
	if err != nil {
		logging.FromContext(ctx).Error("failed to read bootstrap manifests", "path", r.Path, "error", err)
		found = make(map[string]struct{}, 1)
	}
	found[r.DefaultNamespace] = struct{}{}
	return found
}

// DeclaredNamespaces returns the namespaces the resource files under root name. A file that
// names none, or that does not decode as a resource, is left to the repository's own sync to
// provision or report.
func DeclaredNamespaces(ctx context.Context, root string) (map[string]struct{}, error) {
	logger := logging.FromContext(ctx)
	found := make(map[string]struct{})

	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			if path == root {
				return err
			}
			logger.Warn("skipped unreadable bootstrap path", "path", path, "error", err)
			return nil
		}
		if entry.IsDir() {
			return nil
		}

		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		// The same predicates the sync uses to decide a file is a resource, so the scan and
		// the repository cannot disagree about which files declare a namespace.
		if safepath.IsHidden(rel) || !resources.HasResourceExtension(rel) || resources.IsPathSupported(rel) != nil {
			return nil
		}

		//nolint:gosec // the path comes from walking the configured, validated bootstrap root
		data, err := os.ReadFile(path)
		if err != nil {
			logger.Warn("skipped unreadable bootstrap manifest", "path", rel, "error", err)
			return nil
		}
		obj, _, err := resources.DecodeYAMLObject(bytes.NewReader(data))
		if err != nil || obj == nil {
			return nil
		}
		if ns := obj.GetNamespace(); ns != "" {
			found[ns] = struct{}{}
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("read bootstrap manifests: %w", err)
	}
	return found, nil
}
