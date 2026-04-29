package appplugin

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name             string
		ctx              context.Context
		expectedDecision authorizer.Decision
		expectedReason   string
		expectedErr      bool
		fakeAC           actest.FakeAccessControl
	}{
		{
			name:             "denies when access control evaluation fails",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: false, ExpectedErr: fmt.Errorf("eval error")},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "authorization check failed",
			expectedErr:      true,
		},
		{
			name:             "denies when user lacks permission",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: false},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "access denied",
			expectedErr:      false,
		},
		{
			name:             "allows when user has permission",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: true},
			expectedDecision: authorizer.DecisionAllow,
			expectedReason:   "",
			expectedErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := &AppPluginAPIBuilder{
				pluginID:      "test-app",
				accessControl: &tt.fakeAC,
			}

			auth := builder.GetAuthorizer()
			decision, reason, err := auth.Authorize(tt.ctx, authorizer.AttributesRecord{})

			require.Equal(t, tt.expectedDecision, decision)
			require.Equal(t, tt.expectedReason, reason)
			if tt.expectedErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
