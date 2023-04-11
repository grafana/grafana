package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSaveExternalServiceRoleCommand_Validate(t *testing.T) {
	tests := []struct {
		name    string
		cmd     SaveExternalServiceRoleCommand
		wantID  string
		wantErr bool
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
			name: "slugify the external service ID",
			cmd: SaveExternalServiceRoleCommand{
				ExternalServiceID: "ThisIs a Very Strange ___ App Name?",
				Global:            true,
				ServiceAccountID:  2,
				Permissions:       []Permission{{Action: "users:read", Scope: "users:id:1"}},
			},
			wantErr: false,
			wantID:  "thisis-a-very-strange-app-name",
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
		})
	}
}
