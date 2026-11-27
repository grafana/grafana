package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestBackgroundUser(t *testing.T) {
	requester := BackgroundUser("alert_provisioner", 12, org.RoleAdmin, []Permission{
		{Action: "folders:read", Scope: "folders:uid:allowed"},
		{Action: "alert.provisioning:write"},
	})
	name, ok := BackgroundUserName(requester)
	require.True(t, ok)

	require.Equal(t, "alert_provisioner", name)
	require.Equal(t, "grafana_alert_provisioner", requester.GetLogin())
	require.Equal(t, org.RoleAdmin, requester.GetOrgRole())
	require.False(t, requester.GetIsGrafanaAdmin())

	id, err := requester.GetInternalID()
	require.Error(t, err, "background users do not have a database identity")
	require.Zero(t, id)

	require.Equal(t, map[string][]string{
		"folders:read":             {"folders:uid:allowed"},
		"alert.provisioning:write": {""},
	}, requester.GetPermissions())

	_, ok = BackgroundUserName(&user.SignedInUser{Login: requester.GetLogin(), OrgID: 12, OrgRole: org.RoleAdmin})
	require.False(t, ok, "matching login and an absent ID do not identify a trusted background user")
}
