package authorizer

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestNamespaceAuthorizer(t *testing.T) {
	auth := newNamespaceAuthorizer()

	tests := []struct {
		name         string
		requester    *identity.StaticRequester
		attr         authorizer.AttributesRecord
		wantDecision authorizer.Decision
		wantReason   string
		wantErr      bool
	}{
		{
			name: "org 1 admin with default namespace passes",
			requester: &identity.StaticRequester{
				OrgID:     1,
				Namespace: "default",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "default",
			},
			wantDecision: authorizer.DecisionNoOpinion,
		},
		{
			name: "org 1 admin with org-1 namespace is denied without error",
			requester: &identity.StaticRequester{
				OrgID:     1,
				Namespace: "default",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "org-1",
			},
			wantDecision: authorizer.DecisionDeny,
			wantReason:   "invalid namespace",
		},
		{
			name: "org 2 admin with org-1 namespace is denied as invalid namespace",
			requester: &identity.StaticRequester{
				OrgID:     2,
				Namespace: "org-2",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "org-1",
			},
			wantDecision: authorizer.DecisionDeny,
			wantReason:   "invalid namespace",
		},
		{
			name: "org 2 admin with default namespace is denied for wrong org",
			requester: &identity.StaticRequester{
				OrgID:     2,
				Namespace: "org-2",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "default",
			},
			wantDecision: authorizer.DecisionDeny,
			wantReason:   "invalid org",
		},
		{
			name: "org 2 admin with org-2 namespace passes",
			requester: &identity.StaticRequester{
				OrgID:     2,
				Namespace: "org-2",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "org-2",
			},
			wantDecision: authorizer.DecisionNoOpinion,
		},
		{
			name: "grafana admin with org-1 namespace is denied without error",
			requester: &identity.StaticRequester{
				OrgID:          1,
				Namespace:      "default",
				IsGrafanaAdmin: true,
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "org-1",
			},
			wantDecision: authorizer.DecisionDeny,
			wantReason:   "invalid namespace",
		},
		{
			name: "grafana admin with default namespace passes",
			requester: &identity.StaticRequester{
				OrgID:          1,
				Namespace:      "default",
				IsGrafanaAdmin: true,
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "default",
			},
			wantDecision: authorizer.DecisionNoOpinion,
		},
		{
			name: "grafana admin with org-2 namespace passes",
			requester: &identity.StaticRequester{
				OrgID:          1,
				Namespace:      "default",
				IsGrafanaAdmin: true,
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "org-2",
			},
			wantDecision: authorizer.DecisionNoOpinion,
		},
		{
			name: "invalid org namespace format is denied without error",
			requester: &identity.StaticRequester{
				OrgID:     1,
				Namespace: "default",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "org-abc",
			},
			wantDecision: authorizer.DecisionDeny,
			wantReason:   "invalid namespace",
		},
		{
			name: "namespace mismatch is denied",
			requester: &identity.StaticRequester{
				OrgID:     2,
				Namespace: "org-2",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "org-3",
			},
			wantDecision: authorizer.DecisionDeny,
			wantReason:   "invalid org",
		},
		{
			name: "anonymous user with org-1 namespace is denied without error",
			requester: &identity.StaticRequester{
				Type: types.TypeAnonymous,
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "org-1",
			},
			wantDecision: authorizer.DecisionDeny,
			wantReason:   "invalid namespace",
		},
		{
			name: "anonymous user with valid namespace defers to next authorizer",
			requester: &identity.StaticRequester{
				Type:      types.TypeAnonymous,
				OrgID:     1,
				Namespace: "default",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "default",
			},
			wantDecision: authorizer.DecisionNoOpinion,
		},
		{
			name: "non-resource request defers to next authorizer",
			requester: &identity.StaticRequester{
				OrgID:     1,
				Namespace: "default",
			},
			attr: authorizer.AttributesRecord{
				ResourceRequest: false,
				Namespace:       "org-1",
			},
			wantDecision: authorizer.DecisionNoOpinion,
		},
		{
			name: "missing requester returns error",
			attr: authorizer.AttributesRecord{
				ResourceRequest: true,
				Namespace:       "default",
			},
			wantDecision: authorizer.DecisionDeny,
			wantReason:   "missing auth info",
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.requester != nil {
				ctx = identity.WithRequester(ctx, tt.requester)
			}

			decision, reason, err := auth.Authorize(ctx, tt.attr)

			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tt.wantDecision, decision)
			require.Equal(t, tt.wantReason, reason)
		})
	}
}
