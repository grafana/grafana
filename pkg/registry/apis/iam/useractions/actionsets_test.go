package useractions

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestNewActionSetResolver(t *testing.T) {
	resolver := NewActionSetResolver()

	expanded := resolver.ExpandActionSets([]accesscontrol.Permission{
		{Action: "folders:edit", Scope: "folders:uid:abc"},
		{Action: "alert.rules:read"},
	})

	actions := accesscontrol.BuildPermissionsMap(expanded)
	require.True(t, actions["dashboards:read"], "folders:edit must expand to dashboard reads")
	require.True(t, actions["folders:read"])
	require.True(t, actions["dashboards:write"])
	require.True(t, actions["alert.rules:read"], "non action-set permissions must pass through")
}
