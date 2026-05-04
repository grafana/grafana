package pulse

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// captureFakeService records the role registrations passed to
// DeclareFixedRoles. We embed actest.FakeService so we don't have to
// re-implement the full accesscontrol.Service interface here — it's
// already a fully-stubbed implementation.
type captureFakeService struct {
	actest.FakeService
	registrations []accesscontrol.RoleRegistration
}

func (c *captureFakeService) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	c.registrations = append(c.registrations, registrations...)
	return nil
}

func TestRegisterAccessControlRoles_DeclaresExpectedRoles(t *testing.T) {
	svc := &captureFakeService{}

	err := RegisterAccessControlRoles(svc)
	require.NoError(t, err)

	require.Len(t, svc.registrations, 3, "expected reader, writer, admin roles")

	byName := map[string]accesscontrol.RoleRegistration{}
	for _, r := range svc.registrations {
		byName[r.Role.Name] = r
	}

	reader, ok := byName["fixed:pulse:reader"]
	require.True(t, ok, "fixed:pulse:reader should be declared")
	assertHasAction(t, reader.Role.Permissions, ActionRead)
	assert.Contains(t, reader.Grants, string(org.RoleViewer), "reader should be granted to Viewer")
	assert.Contains(t, reader.Grants, accesscontrol.RoleGrafanaAdmin)

	writer, ok := byName["fixed:pulse:writer"]
	require.True(t, ok, "fixed:pulse:writer should be declared")
	assertHasAction(t, writer.Role.Permissions, ActionRead)
	assertHasAction(t, writer.Role.Permissions, ActionWrite)
	assertHasAction(t, writer.Role.Permissions, ActionDelete)
	// Writer is granted to every org role so any signed-in user that can
	// read a dashboard can also comment on it.
	for _, role := range []string{string(org.RoleViewer), string(org.RoleEditor), string(org.RoleAdmin)} {
		assert.Contains(t, writer.Grants, role)
	}

	admin, ok := byName["fixed:pulse:admin"]
	require.True(t, ok, "fixed:pulse:admin should be declared")
	assertHasAction(t, admin.Role.Permissions, ActionAdmin)
	// Admin grant must be tighter than writer — only org Admin and
	// Grafana server admin.
	assert.Contains(t, admin.Grants, string(org.RoleAdmin))
	assert.Contains(t, admin.Grants, accesscontrol.RoleGrafanaAdmin)
	assert.NotContains(t, admin.Grants, string(org.RoleViewer))
	assert.NotContains(t, admin.Grants, string(org.RoleEditor))
}

func assertHasAction(t *testing.T, perms []accesscontrol.Permission, action string) {
	t.Helper()
	for _, p := range perms {
		if p.Action == action {
			return
		}
	}
	t.Fatalf("expected permission %q in %#v", action, perms)
}
