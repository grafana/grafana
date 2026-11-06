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

// Config is the bootstrap repository to register.
type Config struct {
	// Path is the directory the repository reads, as configured.
	Path string
	// Namespace is the org namespace the repository is created in.
	Namespace string
}

// Enabled reports whether a bootstrap repository is configured.
func (c Config) Enabled() bool {
	return c.Path != "" && c.Namespace != ""
}

// matches reports whether repo is already the configured shape.
func (c Config) matches(repo *provisioning.Repository) bool {
	want := repo.DeepCopy()
	c.apply(want)
	return reflect.DeepEqual(repo.Spec, want.Spec) &&
		reflect.DeepEqual(repo.Annotations, want.Annotations)
}

// Ensure creates the bootstrap repository, or brings an existing one back to the configured
// shape. A repository that already matches is left alone, so its sync is not restarted on boot.
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
