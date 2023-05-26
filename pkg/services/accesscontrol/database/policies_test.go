package database

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPolicyHelpers(t *testing.T) {
	require.Equal(t, "dashboard", getKind("dashboards"))
	require.Equal(t, "editor", getBuiltinRoleName("managed:builtins:editor:permissions"))
}
