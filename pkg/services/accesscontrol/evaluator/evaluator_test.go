package evaluator

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractPermission(t *testing.T) {
	const targetPermission = "permissions:create"
	userPermissions := []*accesscontrol.Permission{
		{
			Action: "permissions:create",
			Scope:  "teams:*/permissions:*",
		},
		{
			Action: "permissions:remove",
			Scope:  "permissions:*",
		},
	}
	expectedScopes := map[string]struct{}{
		"teams:*/permissions:*": {},
	}
	ok, scopes := extractScopes(userPermissions, targetPermission)
	assert.True(t, ok)
	assert.Equal(t, expectedScopes, scopes)
}

func TestEvaluatePermissions(t *testing.T) {
	scopes := map[string]struct{}{
		"teams:*/permissions:*": {},
		"users:*":               {},
		"permissions:delegate":  {},
	}

	ok, err := evaluateScope(scopes, "teams:1/permissions:delegate")
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestEvaluatePermissions_WhenAtLeastOneScopeIsMatched_ReturnsTrue(t *testing.T) {
	scopes := map[string]struct{}{
		"teams:*/permissions:*": {},
		"users:*":               {},
		"permissions:delegate":  {},
	}

	ok, err := evaluateScope(scopes, "global:admin", "permissions:delegate")
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestEvaluatePermissions_WhenNoMatchFound_ReturnsFalse(t *testing.T) {
	scopes := map[string]struct{}{
		"teams:*/permissions:*": {},
		"users:*":               {},
		"permissions:delegate":  {},
	}

	ok, err := evaluateScope(scopes, "teams1/permissions:delegate")
	require.NoError(t, err)
	assert.False(t, ok)
}
