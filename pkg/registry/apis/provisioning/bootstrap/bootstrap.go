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

// SyncTarget is exported so the startup guard cannot drift from what applySpec writes.
const SyncTarget = provisioning.SyncTargetTypeFolderless

// updateAttempts bounds the re-read when another replica writes between our read and update.
// The hook runs once per boot, so a dropped conflict stays stale until the next restart.
const updateAttempts = 3

const (
	title = "Bootstrap"
	// Shown in the admin UI, where this repository cannot be configured.
	description = "Instance configuration, synced from the directory set in [provisioning] bootstrap_path. " +
		"Add repositories, connections, dashboards and folders to that directory to provision them on startup."
)

// Repositories is the subset of the generated repository client this package needs.
type Repositories interface {
	Get(ctx context.Context, name string, opts metav1.GetOptions) (*provisioning.Repository, error)
	Create(ctx context.Context, repo *provisioning.Repository, opts metav1.CreateOptions) (*provisioning.Repository, error)
	Update(ctx context.Context, repo *provisioning.Repository, opts metav1.UpdateOptions) (*provisioning.Repository, error)
	Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error
}

// Config is the bootstrap repository to register. An empty Path still needs reconciling: a
// repository an earlier run registered has no source once nothing names its directory.
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

// Reconcile registers the repository and keeps its shape, or removes one an earlier run left
// behind when the path is cleared. The configuration can change between boots, so both run.
func Reconcile(ctx context.Context, repos Repositories, cfg Config) error {
	step := ensure
	if !cfg.Enabled() {
		step = remove
	}

	var err error
	for attempt := 0; attempt < updateAttempts; attempt++ {
		if err = step(ctx, repos, cfg); !apierrors.IsConflict(err) {
			return err
		}
	}
	return err
}

// remove deletes the repository. Deleting it is what clears its job queue and the resources
// it provisioned: a source the configuration no longer names keeps nothing.
func remove(ctx context.Context, repos Repositories, _ Config) error {
	existing, err := repos.Get(ctx, Name, metav1.GetOptions{})
	switch {
	case apierrors.IsNotFound(err):
		return nil
	case err != nil:
		return fmt.Errorf("read bootstrap repository: %w", err)
	case !owned(existing):
		return nil // not ours to remove
	case !existing.DeletionTimestamp.IsZero():
		return nil // its finalizers are already running
	}

	// Bound to the object we vouched for: a repository created under this name between the
	// read and here is not ours, and the failed precondition is the conflict we re-read on.
	// Another replica getting there first is the same outcome.
	err = repos.Delete(ctx, Name, metav1.DeleteOptions{
		Preconditions: metav1.NewUIDPreconditions(string(existing.UID)),
	})
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("delete bootstrap repository: %w", err)
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

	// The name was not reserved before. Repointing an unrelated repository at the bootstrap
	// directory would hand its resources over, and the next full sync would delete them.
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

// create returns a nil repository on success, and the one another writer created when it lost
// the race — which still has to be vouched for.
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
	// Renders the configuration read-only in the UI; what it provisions stays editable.
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:        utils.ManagerKindFileProvisioning,
		Identity:    Name,
		AllowsEdits: false,
	})
	applySpec(&repo.Spec, c.Path)
}

// applySpec replaces spec, so a field it does not set is zero rather than what was stored.
func applySpec(spec *provisioning.RepositorySpec, path string) {
	interval := spec.Sync.IntervalSeconds
	*spec = provisioning.RepositorySpec{
		Title:       title,
		Description: description,
		Type:        provisioning.LocalRepositoryType,
		Local:       &provisioning.LocalRepositoryConfig{Path: path},
		// Edits to provisioned resources route to the files endpoint, which needs this.
		Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
		Sync: provisioning.SyncOptions{
			Enabled: true,
			// The directory is instance configuration, not a folder of dashboards.
			Target:          SyncTarget,
			IntervalSeconds: interval,
		},
	}
}
