package main

import (
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestParseOptions(t *testing.T) {
	t.Setenv(repoTokenEnv, "")
	t.Setenv(grafanaTokenEnv, "")
	t.Setenv(accessTokenEnv, "")
	t.Setenv(exchangeTokenEnv, "")

	tests := []struct {
		name    string
		args    []string
		wantErr string
	}{
		{name: "missing command", args: nil, wantErr: `expected a "pull", "push" or "fix-folder-metadata" command`},
		{name: "unknown command", args: []string{"plan"}, wantErr: `expected a "pull", "push" or "fix-folder-metadata" command`},
		{name: "no repository type", args: []string{"pull"}, wantErr: "set --type"},
		{name: "extra arguments", args: []string{"pull", "--type", "local", "--path", "x", "extra"}, wantErr: "unexpected arguments"},
		{name: "push as a user", args: []string{"push", "--type", "local", "--path", "x", "--grafana-token", "t"}, wantErr: "provisioning service identity"},
		{name: "exchange without token", args: []string{"push", "--type", "local", "--path", "x", "--token-exchange-url", "http://signer"}, wantErr: "needs --exchange-token"},
		{name: "offline push", args: []string{"push", "--type", "local", "--path", "x", "--access-token", "at", "--offline"}, wantErr: "only works with push --dry-run"},
		{name: "incremental pull", args: []string{"pull", "--type", "local", "--path", "x", "--incremental"}, wantErr: "only work with push"},
		{name: "dry-run pull", args: []string{"pull", "--type", "local", "--path", "x", "--dry-run"}, wantErr: "only work with push"},
		{name: "commit options on push", args: []string{"push", "--type", "local", "--path", "x", "--access-token", "at", "--write-branch", "b"}, wantErr: "only work with pull and fix-folder-metadata"},
		{name: "export options on fix-folder-metadata", args: []string{"fix-folder-metadata", "--type", "local", "--path", "x", "--keep-uids"}, wantErr: "only work with pull"},
		{name: "dry-run push as a user", args: []string{"push", "--type", "local", "--path", "x", "--grafana-token", "t", "--dry-run"}},
		{name: "offline dry-run push", args: []string{"push", "--type", "local", "--path", "x", "--dry-run", "--offline"}},
		{name: "push with access token", args: []string{"push", "--type", "github", "--url", "https://github.com/o/r", "--name", "demo", "--state-file", "s.json", "--access-token", "at", "--incremental"}},
		{name: "push with token exchange", args: []string{"push", "--type", "local", "--path", "x", "--token-exchange-url", "http://signer", "--exchange-token", "x"}},
		{name: "pull as a user", args: []string{"pull", "--type", "github", "--url", "https://github.com/o/r", "--write-branch", "export", "--message", "m", "--write-path", "p", "--keep-uids", "--new-folder-ids"}},
		{name: "fix-folder-metadata as a user", args: []string{"fix-folder-metadata", "--type", "github", "--url", "https://github.com/o/r", "--write-branch", "fix", "--message", "m"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseOptions(tt.args, io.Discard)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestParseOptionsReadsTokensFromEnvironment(t *testing.T) {
	t.Setenv(repoTokenEnv, "repo-secret")
	t.Setenv(grafanaTokenEnv, "grafana-secret")
	t.Setenv(accessTokenEnv, "access-secret")
	t.Setenv(exchangeTokenEnv, "exchange-secret")

	opts, err := parseOptions([]string{"push", "--type", "local", "--path", "x"}, io.Discard)
	require.NoError(t, err)
	assert.Equal(t, "repo-secret", opts.token)
	assert.Equal(t, "grafana-secret", opts.grafanaToken)
	assert.Equal(t, "access-secret", opts.accessToken)
	assert.Equal(t, "exchange-secret", opts.exchangeToken)

	opts, err = parseOptions([]string{"push", "--type", "local", "--path", "x", "--token", "flag-secret"}, io.Discard)
	require.NoError(t, err)
	assert.Equal(t, "flag-secret", opts.token, "the flag takes precedence over the environment")
}

func TestRepositoryFromFlags(t *testing.T) {
	t.Run("github", func(t *testing.T) {
		cfg, err := repositoryFromFlags(options{repoType: "github", url: "https://github.com/org/repo", branch: "dev", path: "dashboards", namespace: "default"})
		require.NoError(t, err)
		assert.Equal(t, &provisioning.GitHubRepositoryConfig{URL: "https://github.com/org/repo", Branch: "dev", Path: "dashboards"}, cfg.Spec.GitHub)
		assert.Equal(t, "default", cfg.Namespace)
		assert.Equal(t, "gcx", cfg.Name, "resources pushed from flags are managed by gcx")
		assert.Equal(t, []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow}, cfg.Spec.Workflows)
	})

	t.Run("name", func(t *testing.T) {
		cfg, err := repositoryFromFlags(options{repoType: "local", path: "/tmp/dashboards", name: "demo"})
		require.NoError(t, err)
		assert.Equal(t, "demo", cfg.Name)
	})

	t.Run("git", func(t *testing.T) {
		cfg, err := repositoryFromFlags(options{repoType: "git", url: "https://git.example.com/repo.git", branch: "main", tokenUser: "bot"})
		require.NoError(t, err)
		assert.Equal(t, &provisioning.GitRepositoryConfig{URL: "https://git.example.com/repo.git", Branch: "main", TokenUser: "bot"}, cfg.Spec.Git)
	})

	t.Run("local", func(t *testing.T) {
		cfg, err := repositoryFromFlags(options{repoType: "local", path: "/tmp/dashboards"})
		require.NoError(t, err)
		assert.Equal(t, &provisioning.LocalRepositoryConfig{Path: "/tmp/dashboards"}, cfg.Spec.Local)
		assert.Equal(t, []provisioning.Workflow{provisioning.WriteWorkflow}, cfg.Spec.Workflows, "local repositories have no branches")
	})

	errorCases := map[string]options{
		"git without url":    {repoType: "git"},
		"github without url": {repoType: "github"},
		"local without path": {repoType: "local"},
		"unknown type":       {repoType: "svn"},
	}
	for name, opts := range errorCases {
		t.Run(name, func(t *testing.T) {
			_, err := repositoryFromFlags(opts)
			require.Error(t, err)
		})
	}
}
