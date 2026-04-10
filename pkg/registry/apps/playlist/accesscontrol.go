package playlist

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	ActionPlaylistsRead  = "playlists:read"
	ActionPlaylistsWrite = "playlists:write"
)

var (
	scopeProviderPlaylists = accesscontrol.NewScopeProvider("playlists")
	scopeAllPlaylists      = scopeProviderPlaylists.GetResourceAllScope()
)

func DeclareFixedRoles(service accesscontrol.Service) error {
	playlistsReaderRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "playlists:reader",
			DisplayName: "Reader",
			Description: "Read and list playlists.",
			Group:       "Playlists",
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{Action: ActionPlaylistsRead, Scope: scopeAllPlaylists},
			},
		},
		Grants: []string{string(org.RoleViewer), string(org.RoleEditor), string(org.RoleAdmin)},
	}

	playlistsWriterRole := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "playlists:writer",
			DisplayName: "Writer",
			Description: "Create, update, and delete playlists.",
			Group:       "Playlists",
			Version:     1,
			Permissions: accesscontrol.ConcatPermissions(playlistsReaderRole.Role.Permissions, []accesscontrol.Permission{
				{Action: ActionPlaylistsWrite, Scope: scopeAllPlaylists},
			}),
		},
		Grants: []string{string(org.RoleEditor), string(org.RoleAdmin)},
	}

	return service.DeclareFixedRoles(playlistsReaderRole, playlistsWriterRole)
}
