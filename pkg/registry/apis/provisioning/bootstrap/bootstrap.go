// Package bootstrap registers a local repository over the mounted bootstrap directory, so
// the files there can declare the instance's own repositories and connections.
package bootstrap

import (
	"context"
	"fmt"
	"reflect"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Name is fixed so a restart reconciles the same object instead of creating a second one.
const Name = "bootstrap"

// SyncTarget is the target the bootstrap repository syncs to. Exported so the startup guard
// that checks it is allowed cannot drift from what applySpec writes.
const SyncTarget = provisioning.SyncTargetTypeFolderless

// updateAttempts bounds the re-read when another replica writes between our read and update.
// The hook runs once per boot, so a dropped conflict would leave a changed path stale until
// the next restart.
const updateAttempts = 3

const (
	title = "Bootstrap"
	// Shown in the admin UI, where this repository cannot be configured, so it has to say
	// where its configuration lives and what the directory behind it is for.
	description = "Instance configuration, synced from the directory set in [provisioning] bootstrap_path. " +
		"Add repositories, connections, dashboards and folders to that directory to provision them on startup."
)

// Repositories is the subset of the generated repository client this package needs.
type Repositories interface {
	Get(ctx context.Context, name string, opts metav1.GetOptions) (*provisioning.Repository, error)
	Create(ctx context.Context, repo *provisioning.Repository, opts metav1.CreateOptions) (*provisioning.Repository, error)
	Update(ctx context.Context, repo *provisioning.Repository, opts metav1.UpdateOptions) (*provisioning.Repository, error)
}

// Config is the bootstrap repository to register. An empty Path means none is configured,
// which still needs reconciling: a repository registered on an earlier run must stop syncing
// rather than keep reading a directory the configuration no longer names.
type Config struct {
	// Path is the directory the repository reads, as configured.
	Path string
	// Namespace is the org namespace the repository is created in.
	Namespace string
}

// Reconcilable reports whether there is a namespace to reconcile the repository in.
func (c Config) Reconcilable() bool {
	return c.Namespace != ""
}

// Enabled reports whether a bootstrap repository is configured.
func (c Config) Enabled() bool {
	return c.Path != "" && c.Reconcilable()
}

// matches reports whether repo is already the configured shape.
func (c Config) matches(repo *provisioning.Repository) bool {
	want := repo.DeepCopy()
	c.apply(want)
	return reflect.DeepEqual(repo.Spec, want.Spec) &&
		reflect.DeepEqual(repo.Annotations, want.Annotations)
}

// Reconcile brings the bootstrap repository in line with the configuration: a configured path
// registers it and keeps its shape, a cleared one stops the repository an earlier run left
// behind. Both run on every boot, since the configuration can change between them.
func Reconcile(ctx context.Context, repos Repositories, cfg Config) error {
	step := ensure
	if !cfg.Enabled() {
		step = disable
	}

	var err error
	for attempt := 0; attempt < updateAttempts; attempt++ {
		if err = step(ctx, repos, cfg); !apierrors.IsConflict(err) {
			return err
		}
	}
	return err
}

// disable stops the sync on a bootstrap repository left over from a run that configured one.
// The repository and everything it provisioned are kept: clearing a setting should not delete
// an instance's dashboards, and an operator who wants them gone can delete the repository.
func disable(ctx context.Context, repos Repositories, cfg Config) error {
	existing, err := repos.Get(ctx, Name, metav1.GetOptions{})
	switch {
	case apierrors.IsNotFound(err):
		return nil
	case err != nil:
		return fmt.Errorf("read bootstrap repository: %w", err)
	case !owned(existing):
		return nil // not ours to stop
	case !existing.Spec.Sync.Enabled:
		return nil
	}

	updated := existing.DeepCopy()
	updated.Spec.Sync.Enabled = false
	if _, err := repos.Update(ctx, updated, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("disable bootstrap repository: %w", err)
	}
	return nil
}

func ensure(ctx context.Context, repos Repositories, cfg Config) error {
	existing, err := repos.Get(ctx, Name, metav1.GetOptions{})
	switch {
	case apierrors.IsNotFound(err):
		existing, err = create(ctx, repos, cfg)
		if err != nil {
			return err
		}
		if existing == nil {
			return nil
		}
	case err != nil:
		return fmt.Errorf("read bootstrap repository: %w", err)
	}

	// The name was not reserved before, so an unrelated repository may hold it. Repointing
	// that one at the bootstrap directory would hand its resources to another source, and
	// the next full sync would schedule the ones missing here for deletion.
	if !owned(existing) {
		return fmt.Errorf("a repository named %q already exists and is not managed by %s; rename or remove it to use [provisioning] bootstrap_path",
			Name, utils.ManagerKindFileProvisioning)
	}

	if cfg.matches(existing) {
		return nil
	}
	updated := existing.DeepCopy()
	cfg.apply(updated)
	if _, err := repos.Update(ctx, updated, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("update bootstrap repository: %w", err)
	}
	return nil
}

// create registers the repository. It returns a nil repository when the create succeeded, and
// the object another writer created when it lost the race — which still has to be vouched for.
func create(ctx context.Context, repos Repositories, cfg Config) (*provisioning.Repository, error) {
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: Name, Namespace: cfg.Namespace},
	}
	cfg.apply(repo)
	switch _, err := repos.Create(ctx, repo, metav1.CreateOptions{}); {
	case err == nil:
		return nil, nil
	case !apierrors.IsAlreadyExists(err):
		return nil, fmt.Errorf("create bootstrap repository: %w", err)
	}

	existing, err := repos.Get(ctx, Name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("read bootstrap repository: %w", err)
	}
	return existing, nil
}

// owned reports whether the repository is this mechanism's to reconcile.
func owned(repo *provisioning.Repository) bool {
	meta, err := utils.MetaAccessor(repo)
	if err != nil {
		return false
	}
	manager, ok := meta.GetManagerProperties()
	return ok && manager.Kind == utils.ManagerKindFileProvisioning
}

// apply stamps the configured shape onto repo, leaving the sync interval the server clamps.
func (c Config) apply(repo *provisioning.Repository) {
	meta, err := utils.MetaAccessor(repo)
	if err != nil {
		return // a typed Repository always has an accessor
	}
	// Marks the configuration as owned by bootstrap_path, which renders it read-only in
	// the UI. What this repository provisions is repo-managed, and stays editable.
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:        utils.ManagerKindFileProvisioning,
		Identity:    Name,
		AllowsEdits: false,
	})
	applySpec(&repo.Spec, c.Path)
}

// applySpec stamps the configured shape onto spec.
func applySpec(spec *provisioning.RepositorySpec, path string) {
	spec.Title = title
	spec.Description = description
	spec.Type = provisioning.LocalRepositoryType
	spec.Local = &provisioning.LocalRepositoryConfig{Path: path}
	// Editing a provisioned resource is routed to this repository's files endpoint, which
	// needs a write workflow to accept it.
	spec.Workflows = []provisioning.Workflow{provisioning.WriteWorkflow}
	spec.Sync.Enabled = true
	// The directory is instance configuration, not a folder of dashboards.
	spec.Sync.Target = SyncTarget
	spec.GitHub = nil
	spec.GitHubEnterprise = nil
	spec.Git = nil
	spec.Bitbucket = nil
	spec.GitLab = nil
	spec.Connection = nil
	spec.Webhook = nil
	spec.Branch = nil
	spec.PullRequest = nil
	spec.Commit = nil
}
