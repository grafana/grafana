// Package bootstrap registers the instance's bootstrap repository: a read-only local
// repository over a mounted directory, so the files an operator already mounts can
// declare the rest of the instance's provisioning configuration — repositories and
// connections included — instead of a post-start API call.
package bootstrap

import (
	"context"
	"fmt"
	"reflect"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Name is the metadata.name of the bootstrap repository. It is fixed so that a
// restart reconciles the same object instead of creating a second one.
const Name = "bootstrap"

const (
	title       = "Bootstrap"
	description = "Read-only repository registered from [provisioning] bootstrap_path"
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

// Ensure creates the bootstrap repository, or brings an existing one back to the
// configured shape. It is idempotent: a repository that already matches is left
// untouched, so the sync it owns is not restarted on every boot.
func Ensure(ctx context.Context, repos Repositories, cfg Config) error {
	existing, err := repos.Get(ctx, Name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: Name, Namespace: cfg.Namespace},
		}
		applySpec(&repo.Spec, cfg.Path)
		// Another replica running the same hook may win the race; its object is ours too.
		if _, err := repos.Create(ctx, repo, metav1.CreateOptions{}); err != nil && !apierrors.IsAlreadyExists(err) {
			return fmt.Errorf("create bootstrap repository: %w", err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("read bootstrap repository: %w", err)
	}

	updated := existing.DeepCopy()
	applySpec(&updated.Spec, cfg.Path)
	if reflect.DeepEqual(existing.Spec, updated.Spec) {
		return nil
	}
	if _, err := repos.Update(ctx, updated, metav1.UpdateOptions{}); err != nil {
		return fmt.Errorf("update bootstrap repository: %w", err)
	}
	return nil
}

// applySpec stamps the configured shape onto spec, leaving the fields the server
// owns — the sync interval it clamps to min_sync_interval — as they are.
func applySpec(spec *provisioning.RepositorySpec, path string) {
	spec.Title = title
	spec.Description = description
	spec.Type = provisioning.LocalRepositoryType
	spec.Local = &provisioning.LocalRepositoryConfig{Path: path}
	// An empty workflow list is what makes a repository reject every write, which is
	// also what keeps the resources it provisions read-only: an edit to one of them is
	// routed back to this repository's files endpoint, and rejected there.
	spec.Workflows = []provisioning.Workflow{}
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
