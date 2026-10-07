package github_test

import (
	"context"
	"errors"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
)

type stubConnGetter struct {
	conn *provisioning.Connection
	err  error
}

func (s *stubConnGetter) GetConnectionSpec(_ context.Context, _ string) (*provisioning.Connection, error) {
	return s.conn, s.err
}

func connWithWebhookDisabled(disabled bool) *provisioning.Connection {
	return &provisioning.Connection{
		Spec: provisioning.ConnectionSpec{
			Webhook: &provisioning.ConnectionWebhookConfig{
				Disabled: disabled,
			},
		},
	}
}

func ghRepo(ns, connName string, webhookDisabled bool) *provisioning.Repository {
	r := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-repo",
			Namespace: ns,
		},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL: "https://github.com/org/repo",
			},
		},
	}
	if connName != "" {
		r.Spec.Connection = &provisioning.ConnectionInfo{Name: connName}
	}
	if webhookDisabled {
		r.Spec.Webhook = &provisioning.WebhookConfig{Disabled: true}
	}
	return r
}

func TestConnectionWebhookValidator(t *testing.T) {
	tests := []struct {
		name        string
		repo        *provisioning.Repository
		getter      *stubConnGetter
		wantErrPath string
	}{
		{
			name: "non-github repo is skipped",
			repo: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{Type: provisioning.LocalRepositoryType},
			},
			getter: &stubConnGetter{},
		},
		{
			name:   "no connection name is skipped",
			repo:   ghRepo("default", "", false),
			getter: &stubConnGetter{},
		},
		{
			name:   "repo webhook already disabled, no conflict",
			repo:   ghRepo("default", "my-conn", true),
			getter: &stubConnGetter{conn: connWithWebhookDisabled(true)},
		},
		{
			name:   "connection webhook not disabled, no error",
			repo:   ghRepo("default", "my-conn", false),
			getter: &stubConnGetter{conn: connWithWebhookDisabled(false)},
		},
		{
			name:   "connection not found, no error",
			repo:   ghRepo("default", "my-conn", false),
			getter: &stubConnGetter{err: apierrors.NewNotFound(schema.GroupResource{Resource: "connections"}, "my-conn")},
		},
		{
			name:        "connection webhook disabled but repo is not, error returned",
			repo:        ghRepo("default", "my-conn", false),
			getter:      &stubConnGetter{conn: connWithWebhookDisabled(true)},
			wantErrPath: "spec.webhook.disabled",
		},
		{
			name:   "connection webhook disabled, repo also disabled, no error",
			repo:   ghRepo("default", "my-conn", true),
			getter: &stubConnGetter{conn: connWithWebhookDisabled(true)},
		},
		{
			name:        "getter returns unexpected error, internal error returned",
			repo:        ghRepo("default", "my-conn", false),
			getter:      &stubConnGetter{err: errors.New("storage error")},
			wantErrPath: "spec.connection.name",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := github.NewConnectionWebhookValidator(tc.getter)
			errs := v.Validate(context.Background(), tc.repo)

			if tc.wantErrPath == "" {
				require.Empty(t, errs)
			} else {
				require.NotEmpty(t, errs)
				assert.Equal(t, tc.wantErrPath, errs[0].Field)
			}
		})
	}
}
