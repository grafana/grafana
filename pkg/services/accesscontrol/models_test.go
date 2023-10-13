package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSaveExternalServiceRoleCommand_Validate(t *testing.T) {
	tests := []struct {
		name            string
		cmd             SaveExternalServiceRoleCommand
		wantID          string
		wantPermissions []Permission
		wantErr         bool
	}{
		{
			name: "invalid global statement",
			cmd: SaveExternalServiceRoleCommand{
				OrgID:             1,
				Global:            true,
				ExternalServiceID: "app 1",
				ServiceAccountID:  2,
				Permissions:       []Permission{{Action: "users:read", Scope: "users:id:1"}},
			},
			wantErr: true,
		},
		{
			name: "invalid no permissions",
			cmd: SaveExternalServiceRoleCommand{
				OrgID:             1,
				ExternalServiceID: "app 1",
				ServiceAccountID:  2,
				Permissions:       []Permission{},
			},
			wantErr: true,
		},
		{
			name: "invalid service account id",
			cmd: SaveExternalServiceRoleCommand{
				OrgID:             1,
				ExternalServiceID: "app 1",
				ServiceAccountID:  -1,
				Permissions:       []Permission{{Action: "users:read", Scope: "users:id:1"}},
			},
			wantErr: true,
		},
		{
			name: "invalid no Ext Service ID",
			cmd: SaveExternalServiceRoleCommand{
				OrgID:            1,
				ServiceAccountID: 2,
				Permissions:      []Permission{{Action: "users:read", Scope: "users:id:1"}},
			},
			wantErr: true,
		},
		{
			name: "slugify the external service ID correctly",
			cmd: SaveExternalServiceRoleCommand{
				ExternalServiceID: "ThisIs a Very Strange ___ App Name?",
				Global:            true,
				ServiceAccountID:  2,
				Permissions:       []Permission{{Action: "users:read", Scope: "users:id:1"}},
			},
			wantErr: false,
			wantID:  "thisis-a-very-strange-app-name",
		},
		{
			name: "invalid empty Action",
			cmd: SaveExternalServiceRoleCommand{
				OrgID:             1,
				ExternalServiceID: "app 1",
				ServiceAccountID:  2,
				Permissions:       []Permission{{Action: "", Scope: "users:id:1"}},
			},
			wantID:  "app-1",
			wantErr: true,
		},
		{
			name: "permission deduplication",
			cmd: SaveExternalServiceRoleCommand{
				OrgID:             1,
				ExternalServiceID: "app 1",
				ServiceAccountID:  2,
				Permissions: []Permission{
					{Action: "users:read", Scope: "users:id:1"},
					{Action: "users:read", Scope: "users:id:1"},
				},
			},
			wantErr:         false,
			wantID:          "app-1",
			wantPermissions: []Permission{{Action: "users:read", Scope: "users:id:1"}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cmd.Validate()
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.Equal(t, tt.wantID, tt.cmd.ExternalServiceID)
			if tt.wantPermissions != nil {
				require.ElementsMatch(t, tt.wantPermissions, tt.cmd.Permissions)
			}
		})
	}
}

func TestPermission_ScopeSplit(t *testing.T) {
	type testCase struct {
		desc       string
		scope      string
		kind       string
		attribute  string
		identifier string
	}

	tests := []testCase{
		{desc: "all fields should be empty for empty scope", scope: "", kind: "", attribute: "", identifier: ""},
		{desc: "all fields should be set to * for wildcard", scope: "*", kind: "*", attribute: "*", identifier: "*"},
		{desc: "kind should be specified and attribute and identifier should be * for a wildcard with kind prefix", scope: "dashboards:*", kind: "dashboards", attribute: "*", identifier: "*"},
		{desc: "all fields should be set correctly", scope: "dashboards:uid:123", kind: "dashboards", attribute: "uid", identifier: "123"},
		{desc: "can handle a case with : in the uid", scope: "datasources:uid:weird:name", kind: "datasources", attribute: "uid", identifier: "weird:name"},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			p := Permission{Scope: tt.scope}

			kind, attribute, identifier := p.SplitScope()
			assert.Equal(t, tt.kind, kind)
			assert.Equal(t, tt.attribute, attribute)
			assert.Equal(t, tt.identifier, identifier)
		})
	}
}
