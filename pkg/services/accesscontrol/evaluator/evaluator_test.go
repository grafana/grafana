package evaluator

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
	tests := []struct {
		Name         string
		HasScopes    map[string]struct{}
		NeedAnyScope []string
		Valid        bool
	}{
		{
			Name:         "Base",
			HasScopes:    map[string]struct{}{},
			NeedAnyScope: []string{},
			Valid:        true,
		},
		{
			Name: "No expected scope always returns true",
			HasScopes: map[string]struct{}{
				"teams:*/permissions:*": {},
				"users:*":               {},
				"permissions:delegate":  {},
			},
			NeedAnyScope: []string{},
			Valid:        true,
		},
		{
			Name: "Single scope from  list",
			HasScopes: map[string]struct{}{
				"teams:1/permissions:delegate": {},
			},
			NeedAnyScope: []string{"teams:1/permissions:delegate"},
			Valid:        true,
		},
		{
			Name: "Single scope from glob list",
			HasScopes: map[string]struct{}{
				"teams:*/permissions:*": {},
				"users:*":               {},
				"permissions:delegate":  {},
			},
			NeedAnyScope: []string{"teams:1/permissions:delegate"},
			Valid:        true,
		},
		{
			Name: "Either of two scopes from glob list",
			HasScopes: map[string]struct{}{
				"teams:*/permissions:*": {},
				"users:*":               {},
				"permissions:delegate":  {},
			},
			NeedAnyScope: []string{"global:admin", "permissions:delegate"},
			Valid:        true,
		},
		{
			Name: "No match found",
			HasScopes: map[string]struct{}{
				"teams:*/permissions:*": {},
				"users:*":               {},
				"permissions:delegate":  {},
			},
			NeedAnyScope: []string{"teams1/permissions:delegate"},
			Valid:        false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			ok, err := evaluateScope(tc.HasScopes, tc.NeedAnyScope...)
			require.NoError(t, err)
			assert.Equal(t, tc.Valid, ok)
		})
	}
}
