package playlist

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

// mockACService records the role registrations passed to DeclareFixedRoles
type mockACService struct {
	accesscontrol.Service
	registrations []accesscontrol.RoleRegistration
}

func (m *mockACService) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	m.registrations = append(m.registrations, registrations...)
	return nil
}

func TestDeclareFixedRoles(t *testing.T) {
	svc := &mockACService{}
	err := DeclareFixedRoles(svc)
	require.NoError(t, err)
	require.Len(t, svc.registrations, 2)

	var reader, writer *accesscontrol.RoleRegistration
	for i := range svc.registrations {
		reg := &svc.registrations[i]
		switch reg.Role.Name {
		case accesscontrol.FixedRolePrefix + "playlists:reader":
			reader = reg
		case accesscontrol.FixedRolePrefix + "playlists:writer":
			writer = reg
		}
	}

	t.Run("reader role", func(t *testing.T) {
		require.NotNil(t, reader, "playlists:reader role not registered")
		assert.Equal(t, "Playlists", reader.Role.Group)
		require.Len(t, reader.Role.Permissions, 1)
		assert.Equal(t, ActionPlaylistsRead, reader.Role.Permissions[0].Action)
		assert.Equal(t, "playlists:*", reader.Role.Permissions[0].Scope)
		assert.Contains(t, reader.Grants, string(org.RoleViewer))
		assert.Contains(t, reader.Grants, string(org.RoleEditor))
		assert.Contains(t, reader.Grants, string(org.RoleAdmin))
		assert.NotContains(t, reader.Grants, string(org.RoleNone))
	})

	t.Run("writer role", func(t *testing.T) {
		require.NotNil(t, writer, "playlists:writer role not registered")
		assert.Equal(t, "Playlists", writer.Role.Group)

		actions := make([]string, 0, len(writer.Role.Permissions))
		for _, p := range writer.Role.Permissions {
			actions = append(actions, p.Action)
		}
		assert.Contains(t, actions, ActionPlaylistsRead, "writer role should include read permission")
		assert.Contains(t, actions, ActionPlaylistsWrite, "writer role should include write permission")
		for _, p := range writer.Role.Permissions {
			assert.Equal(t, "playlists:*", p.Scope)
		}

		assert.NotContains(t, writer.Grants, string(org.RoleViewer))
		assert.Contains(t, writer.Grants, string(org.RoleEditor))
		assert.Contains(t, writer.Grants, string(org.RoleAdmin))
		assert.NotContains(t, writer.Grants, string(org.RoleNone))
	})
}
