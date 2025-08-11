package advisor

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name             string
		ctx              context.Context
		attr             authorizer.Attributes
		expectedDecision authorizer.Decision
		expectedReason   string
		expectedErr      error
	}{
		{
			name:             "non-resource request",
			ctx:              context.TODO(),
			attr:             &mockAttributes{resourceRequest: false},
			expectedDecision: authorizer.DecisionNoOpinion,
			expectedReason:   "",
			expectedErr:      nil,
		},
		{
			name:             "user is admin",
			ctx:              identity.WithRequester(context.TODO(), &mockUser{isGrafanaAdmin: true}),
			attr:             &mockAttributes{resourceRequest: true},
			expectedDecision: authorizer.DecisionAllow,
			expectedReason:   "",
			expectedErr:      nil,
		},
		{
			name:             "user is not admin",
			ctx:              identity.WithRequester(context.TODO(), &mockUser{isGrafanaAdmin: false}),
			attr:             &mockAttributes{resourceRequest: true},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "forbidden",
			expectedErr:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth := GetAuthorizer()
			decision, reason, err := auth.Authorize(tt.ctx, tt.attr)
			assert.Equal(t, tt.expectedDecision, decision)
			assert.Equal(t, tt.expectedReason, reason)
			assert.Equal(t, tt.expectedErr, err)
		})
	}
}

type mockAttributes struct {
	authorizer.Attributes
	resourceRequest bool
}

func (m *mockAttributes) IsResourceRequest() bool {
	return m.resourceRequest
}

// Implement other methods of authorizer.Attributes as needed

type mockUser struct {
	identity.Requester
	isGrafanaAdmin bool
}

func (m *mockUser) GetIsGrafanaAdmin() bool {
	return m.isGrafanaAdmin
}

func (m *mockUser) HasRole(role identity.RoleType) bool {
	return role == identity.RoleAdmin && m.isGrafanaAdmin
}

// Implement other methods of identity.Requester as needed
