package inmemory

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/types"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func newTestInstaller() *InMemoryGlobalRoleApiInstaller {
	return &InMemoryGlobalRoleApiInstaller{}
}

func TestValidateOnCreateReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.ValidateOnCreate(context.Background(), &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestValidateOnUpdateReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.ValidateOnUpdate(context.Background(), &iamv0.GlobalRole{}, &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestValidateOnDeleteReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.ValidateOnDelete(context.Background(), &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestMutateOnCreateReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.MutateOnCreate(context.Background(), &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestMutateOnUpdateReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.MutateOnUpdate(context.Background(), &iamv0.GlobalRole{}, &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestMutateOnDeleteReturnsError(t *testing.T) {
	installer := newTestInstaller()
	err := installer.MutateOnDelete(context.Background(), &iamv0.GlobalRole{})
	require.Error(t, err)
}

func TestMutateOnConnectReturnsNil(t *testing.T) {
	installer := newTestInstaller()
	err := installer.MutateOnConnect(context.Background(), &iamv0.GlobalRole{})
	assert.NoError(t, err)
}

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name         string
		ctx          context.Context
		verb         string
		wantDecision authorizer.Decision
	}{
		{
			name:         "unauthenticated is denied",
			ctx:          context.Background(),
			verb:         utils.VerbGet,
			wantDecision: authorizer.DecisionDeny,
		},
		{
			name:         "access policy get is allowed",
			ctx:          types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeAccessPolicy}),
			verb:         utils.VerbGet,
			wantDecision: authorizer.DecisionAllow,
		},
		{
			name:         "access policy list is allowed",
			ctx:          types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeAccessPolicy}),
			verb:         utils.VerbList,
			wantDecision: authorizer.DecisionAllow,
		},
		{
			name:         "access policy create is denied",
			ctx:          types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeAccessPolicy}),
			verb:         utils.VerbCreate,
			wantDecision: authorizer.DecisionDeny,
		},
		{
			name:         "access policy update is denied",
			ctx:          types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeAccessPolicy}),
			verb:         utils.VerbUpdate,
			wantDecision: authorizer.DecisionDeny,
		},
		{
			name:         "access policy delete is denied",
			ctx:          types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeAccessPolicy}),
			verb:         utils.VerbDelete,
			wantDecision: authorizer.DecisionDeny,
		},
		{
			name:         "user get is denied",
			ctx:          types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeUser}),
			verb:         utils.VerbGet,
			wantDecision: authorizer.DecisionDeny,
		},
		{
			name:         "user list is denied",
			ctx:          types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeUser}),
			verb:         utils.VerbList,
			wantDecision: authorizer.DecisionDeny,
		},
		{
			name:         "service account get is denied",
			ctx:          types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeServiceAccount}),
			verb:         utils.VerbGet,
			wantDecision: authorizer.DecisionDeny,
		},
	}

	authz := newTestInstaller().GetAuthorizer()
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			decision, _, err := authz.Authorize(tc.ctx, authorizer.AttributesRecord{Verb: tc.verb})
			require.NoError(t, err)
			assert.Equal(t, tc.wantDecision, decision)
		})
	}
}
