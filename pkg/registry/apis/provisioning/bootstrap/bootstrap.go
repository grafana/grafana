// Package bootstrap registers the instance's bootstrap repository: a local repository
// over a mounted directory, so the files an operator already mounts can declare the rest
// of the instance's provisioning configuration — repositories and connections included —
// instead of a post-start API call. The repository's own configuration comes from
// grafana.ini and is not editable; what it provisions is.
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

// Name is the metadata.name of the bootstrap repository. It is fixed so that a
// restart reconciles the same object instead of creating a second one.
const Name = "bootstrap"

const (
	title       = "Bootstrap"
	description = "Registered from [provisioning] bootstrap_path"
)

// Repositories is the subset of the generated repository client this package needs.
type Repositories interface {
	Get(ctx context.Context, name string, opts metav1.GetOptions) (*provisioning.Repository, error)
	Create(ctx context.Context, repo *provisioning.Repository, opts metav1.CreateOptions) (*provisioning.Repository, error)
	Update(ctx context.Context, repo *provisioning.Repository, opts metav1.UpdateOptions) (*provisioning.Repository, error)
}

// Config is the bootstrap repository to register.
type Config struct {
	// Path is the directory the repository reads, as configured. It must resolve
	// under one of the permitted provisioning paths.
	Path string
	// Namespace is the org namespace the repository is created in.
	Namespace string
}

// Enabled reports whether a bootstrap repository is configured.
func (c Config) Enabled() bool {
	return c.Path != "" && c.Namespace != ""
}

// matches reports whether repo is already the configured shape, so Ensure can leave it
// untouched rather than restart the sync it owns on every boot.
func (c Config) matches(repo *provisioning.Repository) bool {
	want := repo.DeepCopy()
	c.apply(want)
	return reflect.DeepEqual(repo.Spec, want.Spec) &&
		reflect.DeepEqual(repo.Annotations, want.Annotations)
}

// Ensure creates the bootstrap repository, or brings an existing one back to the
// configured shape. It is idempotent: a repository that already matches is left
// untouched, so the sync it owns is not restarted on every boot.
func Ensure(ctx context.Context, repos Repositories, cfg Config) error {
	existing, err := repos.Get(ctx, Name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: Name, Namespace: cfg.Namespace},
		}
		cfg.apply(repo)
		// Another replica running the same hook may win the race; its object is ours too.
		if _, err := repos.Create(ctx, repo, metav1.CreateOptions{}); err != nil && !apierrors.IsAlreadyExists(err) {
			return fmt.Errorf("create bootstrap repository: %w", err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("read bootstrap repository: %w", err)
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

// apply stamps the configured shape onto repo, leaving the fields the server owns — the
// sync interval it clamps to min_sync_interval — as they are.
func (c Config) apply(repo *provisioning.Repository) {
	meta, err := utils.MetaAccessor(repo)
	if err != nil {
		return // a typed Repository always has an accessor
	}
	// The configuration comes from the file the instance was started with, so the UI
	// renders this repository read-only: a manager that is not the repository flow, and
	// does not allow edits. The resources it provisions are not covered by this -- they
	// are repository-managed, and the write workflow below keeps them editable.
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:        utils.ManagerKindClassicFP, //nolint:staticcheck
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
	// The resources provisioned from the directory stay editable: an edit to one of them
	// is routed back to this repository's files endpoint, which needs a write workflow to
	// accept it. What is not editable is this repository itself, see apply.
	spec.Workflows = []provisioning.Workflow{provisioning.WriteWorkflow}
	spec.Sync.Enabled = true
	// Folderless: the mounted directory is instance configuration, not a folder of
	// dashboards, so its files land at the top level without a wrapper folder.
	spec.Sync.Target = provisioning.SyncTargetTypeFolderless
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
