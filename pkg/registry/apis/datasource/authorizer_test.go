package datasource

import (
	"context"
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
)

func TestDataSourceAuthorizerLegacyPath(t *testing.T) {
	t.Parallel()

	newRequesterCtx := func() context.Context {
		return identity.WithRequester(context.Background(), &identity.StaticRequester{
			OrgID: 1,
		})
	}

	tests := []struct {
		name       string
		ctx        context.Context
		attr       authorizer.AttributesRecord
		access     actest.FakeAccessControl
		want       authorizer.Decision
		wantReason string
		wantErr    bool
	}{
		{
			name: "returns no opinion for non-resource requests",
			ctx:  context.Background(),
			attr: authorizer.AttributesRecord{
				ResourceRequest: false,
			},
			want: authorizer.DecisionNoOpinion,
		},
		{
			name: "denies when requester is missing",
			ctx:  context.Background(),
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            "get",
				Name:            "uid-1",
			},
			want:       authorizer.DecisionDeny,
			wantReason: "valid user is required",
			wantErr:    true,
		},
		{
			name: "allows list when read check succeeds",
			ctx:  newRequesterCtx(),
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            "list",
			},
			access: actest.FakeAccessControl{ExpectedEvaluate: true},
			want:   authorizer.DecisionAllow,
		},
		{
			name: "denies subresource when query check fails",
			ctx:  newRequesterCtx(),
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            "get",
				Name:            "uid-1",
				Subresource:     "query",
			},
			access:     actest.FakeAccessControl{ExpectedEvaluate: false},
			want:       authorizer.DecisionDeny,
			wantReason: "unable to query",
		},
		{
			name: "denies proxy subresource even when query check succeeds",
			ctx:  newRequesterCtx(),
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            "get",
				Name:            "uid-1",
				Subresource:     "proxy",
			},
			access:     actest.FakeAccessControl{ExpectedEvaluate: true},
			want:       authorizer.DecisionDeny,
			wantReason: "TODO: map the plugin settings to access rules",
		},
		{
			name: "denies unsupported verbs",
			ctx:  newRequesterCtx(),
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            "watch",
				Name:            "uid-1",
			},
			access:     actest.FakeAccessControl{ExpectedEvaluate: true},
			want:       authorizer.DecisionDeny,
			wantReason: "unsupported verb",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			b := &DataSourceAPIBuilder{
				accessControl: &tt.access,
			}
			auth := b.GetAuthorizer()

			gotDecision, gotReason, err := auth.Authorize(tt.ctx, tt.attr)
			require.Equal(t, tt.want, gotDecision)
			require.Equal(t, tt.wantReason, gotReason)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestDataSourceAuthorizerAccessClientPath(t *testing.T) {
	t.Parallel()

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1,
	})
	attr := authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        "prometheus.datasource.grafana.app",
		Resource:        "connections",
		Namespace:       "default",
		Name:            "uid-1",
		Verb:            "get",
	}

	tests := []struct {
		name       string
		access     authtypes.AccessClient
		want       authorizer.Decision
		wantReason string
	}{
		{
			name:   "allows when access client allows",
			access: authtypes.FixedAccessClient(true),
			want:   authorizer.DecisionAllow,
		},
		{
			name:       "denies when access client denies",
			access:     authtypes.FixedAccessClient(false),
			want:       authorizer.DecisionDeny,
			wantReason: "unauthorized request",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			// Keep legacy access control false to prove the access client branch is selected.
			b := (&DataSourceAPIBuilder{
				accessControl: &actest.FakeAccessControl{ExpectedEvaluate: false},
			}).WithAccessClient(tt.access)

			auth := b.GetAuthorizer()
			gotDecision, gotReason, err := auth.Authorize(ctx, attr)

			require.NoError(t, err)
			require.Equal(t, tt.want, gotDecision)
			require.Equal(t, tt.wantReason, gotReason)
		})
	}
}
