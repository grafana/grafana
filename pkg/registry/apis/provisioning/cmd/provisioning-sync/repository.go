package main

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	// defaultManager is the manager identity of resources pushed from a repository described by
	// flags: they are managed by repo "gcx", the CLI that owns them.
	defaultManager = "gcx"
	userAgent      = "grafana-provisioning-sync-cli"
)

// repositoryFromFlags describes a repository that does not exist in Grafana.
func repositoryFromFlags(opts options) (*provisioning.Repository, error) {
	name := opts.name
	if name == "" {
		name = defaultManager
	}
	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: opts.namespace},
		Spec: provisioning.RepositorySpec{
			Title: name,
			Type:  provisioning.RepositoryType(opts.repoType),
			Sync:  provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
		},
	}

	switch cfg.Spec.Type {
	case provisioning.GitRepositoryType:
		if opts.url == "" {
			return nil, fmt.Errorf("--url is required for a git repository")
		}
		cfg.Spec.Git = &provisioning.GitRepositoryConfig{URL: opts.url, Branch: opts.branch, Path: opts.path, TokenUser: opts.tokenUser}
	case provisioning.GitHubRepositoryType:
		if opts.url == "" {
			return nil, fmt.Errorf("--url is required for a GitHub repository")
		}
		cfg.Spec.GitHub = &provisioning.GitHubRepositoryConfig{URL: opts.url, Branch: opts.branch, Path: opts.path}
	case provisioning.LocalRepositoryType:
		if opts.path == "" {
			return nil, fmt.Errorf("--path is required for a local repository")
		}
		cfg.Spec.Local = &provisioning.LocalRepositoryConfig{Path: opts.path}
	default:
		return nil, fmt.Errorf("unsupported repository type %q: expected git, github or local", opts.repoType)
	}

	// Write access is what pull and fix-folder-metadata ask for; the branch workflow only applies to git.
	cfg.Spec.Workflows = []provisioning.Workflow{provisioning.WriteWorkflow}
	if cfg.Spec.Type.IsGit() {
		cfg.Spec.Workflows = append(cfg.Spec.Workflows, provisioning.BranchWorkflow)
	}
	return cfg, nil
}

// buildRepository builds the same repository implementation the server would, but with the
// token given on the command line instead of one decrypted from Grafana's secrets service.
func buildRepository(ctx context.Context, cfg *provisioning.Repository, token string) (repository.Repository, error) {
	decrypter := func(*provisioning.Repository) repository.SecureValues {
		return staticSecrets{token: common.RawSecureValue(token)}
	}

	var extra repository.Extra
	switch cfg.Spec.Type {
	case provisioning.GitRepositoryType:
		extra = git.Extra(decrypter, true, nil, nil, userAgent)
	case provisioning.GitHubRepositoryType:
		// No webhook builder: the CLI never registers webhooks.
		extra = github.Extra(decrypter, github.ProvideFactory(), nil, true, nil, nil, userAgent)
	case provisioning.LocalRepositoryType:
		// The command line chose this path, so it is the one prefix the CLI permits. A relative
		// path resolves against the working directory.
		extra = local.Extra(".", []string{local.ResolvePath(".", cfg.Spec.Local.Path)}, nil)
	default:
		return nil, fmt.Errorf("unsupported repository type %q", cfg.Spec.Type)
	}

	return extra.Build(ctx, cfg)
}

// staticSecrets hands the repository builders the command-line token. The CLI never signs
// commits or registers webhooks, so it has no signing key or webhook secret to give.
type staticSecrets struct {
	token common.RawSecureValue
}

func (s staticSecrets) Token(context.Context) (common.RawSecureValue, error) {
	return s.token, nil
}

func (s staticSecrets) WebhookSecret(context.Context) (common.RawSecureValue, error) {
	return "", nil
}

func (s staticSecrets) CommitSigningKey(context.Context) (common.RawSecureValue, error) {
	return "", nil
}
