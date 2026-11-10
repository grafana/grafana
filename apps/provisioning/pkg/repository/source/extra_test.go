package source_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestValidate(t *testing.T) {
	valid := func(mutate func(*provisioning.Repository)) *provisioning.Repository {
		repo := &provisioning.Repository{Spec: provisioning.RepositorySpec{
			Type:   provisioning.SourceRepositoryType,
			Source: &provisioning.SourceRepositoryConfig{URL: "https://source.example.com/v1/sources/stacks-1"},
		}}
		if mutate != nil {
			mutate(repo)
		}
		return repo
	}

	tests := []struct {
		name          string
		repo          *provisioning.Repository
		allowInsecure bool
		wantFields    []string
	}{
		{name: "valid", repo: valid(nil)},
		{
			name:       "missing config",
			repo:       valid(func(r *provisioning.Repository) { r.Spec.Source = nil }),
			wantFields: []string{"spec.source"},
		},
		{
			name:       "missing url",
			repo:       valid(func(r *provisioning.Repository) { r.Spec.Source.URL = "" }),
			wantFields: []string{"spec.source.url"},
		},
		{
			name:       "http is refused",
			repo:       valid(func(r *provisioning.Repository) { r.Spec.Source.URL = "http://source.example.com/v1/sources/x" }),
			wantFields: []string{"spec.source.url"},
		},
		{
			name:          "http is allowed in dev",
			repo:          valid(func(r *provisioning.Repository) { r.Spec.Source.URL = "http://127.0.0.1:8099/v1/sources/x" }),
			allowInsecure: true,
		},
		{
			name: "credentials in the url",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Source.URL = "https://user:pass@source.example.com/v1/sources/x"
			}),
			wantFields: []string{"spec.source.url"},
		},
		{
			name: "query in the url",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Source.URL = "https://source.example.com/v1/sources/x?token=1"
			}),
			wantFields: []string{"spec.source.url"},
		},
		{
			name: "write workflow lets Grafana edit the source",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Workflows = []provisioning.Workflow{provisioning.WriteWorkflow}
			}),
		},
		{
			name: "a source has no branches",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Workflows = []provisioning.Workflow{provisioning.BranchWorkflow}
			}),
			wantFields: []string{"spec.workflows[0]"},
		},
		{
			name: "git-only options",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Commit = &provisioning.CommitOptions{}
				r.Spec.Branch = &provisioning.BranchOptions{}
				r.Spec.PullRequest = &provisioning.PullRequestOptions{}
			}),
			wantFields: []string{"spec.commit", "spec.branch", "spec.pullRequest"},
		},
		{
			name:       "bearer with a connection",
			repo:       valid(func(r *provisioning.Repository) { r.Spec.Connection = &provisioning.ConnectionInfo{Name: "c"} }),
			wantFields: []string{"spec.connection"},
		},
		{
			name: "clientCredentials needs a connection",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Source.Auth = &provisioning.SourceAuth{Type: provisioning.SourceAuthClientCredentials}
			}),
			wantFields: []string{"spec.connection.name"},
		},
		{
			name: "clientCredentials with a connection",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Source.Auth = &provisioning.SourceAuth{Type: provisioning.SourceAuthClientCredentials}
				r.Spec.Connection = &provisioning.ConnectionInfo{Name: "c"}
			}),
		},
		{
			name: "clientCredentials with the token minted from the connection",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Source.Auth = &provisioning.SourceAuth{Type: provisioning.SourceAuthClientCredentials}
				r.Spec.Connection = &provisioning.ConnectionInfo{Name: "c"}
				r.Secure.Token = common.InlineSecureValue{Create: "t"}
			}),
		},
		{
			name: "tokenExchange takes nothing",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Source.Auth = &provisioning.SourceAuth{Type: provisioning.SourceAuthTokenExchange}
				r.Secure.Token = common.InlineSecureValue{Create: "t"}
			}),
			wantFields: []string{"spec.source.auth.type"},
		},
		{
			name:       "unknown auth type",
			repo:       valid(func(r *provisioning.Repository) { r.Spec.Source.Auth = &provisioning.SourceAuth{Type: "magic"} }),
			wantFields: []string{"spec.source.auth.type"},
		},
		{
			name: "allow entries need a group and a kind",
			repo: valid(func(r *provisioning.Repository) {
				r.Spec.Source.Allow = []provisioning.SourceAllowedKind{{Group: "plugins.grafana.app"}, {Kind: "Plugin"}}
			}),
			wantFields: []string{"spec.source.allow[0].kind", "spec.source.allow[1].group"},
		},
		{
			name:       "unknown empty tree policy",
			repo:       valid(func(r *provisioning.Repository) { r.Spec.Source.EmptyTreePolicy = "shrug" }),
			wantFields: []string{"spec.source.emptyTreePolicy"},
		},
		{
			name:       "a CA bundle that is not PEM",
			repo:       valid(func(r *provisioning.Repository) { r.Spec.Source.TLS = &provisioning.SourceTLS{CABundle: "nope"} }),
			wantFields: []string{"spec.source.tls.caBundle"},
		},
		{
			name: "other types are not this extra's business",
			repo: valid(func(r *provisioning.Repository) { r.Spec.Type = provisioning.LocalRepositoryType; r.Spec.Source = nil }),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := source.Extra(nil, tt.allowInsecure, nil).Validate(context.Background(), tt.repo)

			got := make([]string, 0, len(errs))
			for _, err := range errs {
				got = append(got, err.Field)
			}
			assert.ElementsMatch(t, tt.wantFields, got, errs.ToAggregate())
		})
	}
}
