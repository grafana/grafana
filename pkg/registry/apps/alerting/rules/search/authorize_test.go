package search

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type mockAttributes struct {
	authorizer.Attributes
	resource string
}

func (m *mockAttributes) GetResource() string { return m.resource }

type mockAccessControl struct {
	accesscontrol.AccessControl
	evaluateFunc func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error)
}

func (m *mockAccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	return m.evaluateFunc(ctx, user, evaluator)
}

func TestAuthorize(t *testing.T) {
	viewer := func() context.Context {
		return identity.WithRequester(context.Background(), &identity.StaticRequester{
			OrgID:   1,
			UserID:  1,
			OrgRole: identity.RoleViewer,
		})
	}

	t.Run("non-search resource yields no opinion without evaluating", func(t *testing.T) {
		ac := &mockAccessControl{evaluateFunc: func(context.Context, identity.Requester, accesscontrol.Evaluator) (bool, error) {
			t.Fatal("should not evaluate access for a non-search resource")
			return false, nil
		}}
		decision, _, err := Authorize(viewer(), ac, &mockAttributes{resource: "alertrules"})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionNoOpinion, decision)
	})

	t.Run("search with rule-read permission allows", func(t *testing.T) {
		var evaluated string
		ac := &mockAccessControl{evaluateFunc: func(_ context.Context, _ identity.Requester, e accesscontrol.Evaluator) (bool, error) {
			evaluated = e.String()
			return true, nil
		}}
		decision, _, err := Authorize(viewer(), ac, &mockAttributes{resource: RouteResource})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
		assert.Contains(t, evaluated, accesscontrol.ActionAlertingRuleRead)
	})

	t.Run("search without rule-read permission denies", func(t *testing.T) {
		ac := &mockAccessControl{evaluateFunc: func(context.Context, identity.Requester, accesscontrol.Evaluator) (bool, error) {
			return false, nil
		}}
		decision, _, err := Authorize(viewer(), ac, &mockAttributes{resource: RouteResource})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("missing user denies", func(t *testing.T) {
		ac := &mockAccessControl{evaluateFunc: func(context.Context, identity.Requester, accesscontrol.Evaluator) (bool, error) {
			t.Fatal("should not evaluate access without a requester")
			return false, nil
		}}
		decision, reason, err := Authorize(context.Background(), ac, &mockAttributes{resource: RouteResource})
		require.Error(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
		assert.True(t, strings.Contains(reason, "valid user is required"))
	})
}
