package oauthstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestStore_RegisterAndGetClient(t *testing.T) {
	s := &Store{db: sqlstore.InitTestDB(t)}
	tests := []struct {
		name    string
		client  oauthserver.Client
		wantErr bool
	}{
		{
			name: "register without impersonate permissions and get",
			client: oauthserver.Client{
				ID:                  1,
				ExternalServiceName: "The Worst App Ever",
				ClientID:            "AnNonRandomClientID",
				Secret:              "ICouldKeepSecrets",
				GrantTypes:          "clients_credentials",
				PublicPem: []byte(`------BEGIN FAKE PUBLIC KEY-----
VGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBO
b3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNB
IEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhp
cyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3Qg
QW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtl
eS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJ
cyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4g
UlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4g
VGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBO
b3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNB
IEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhp
cyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3Qg
QW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtl
eS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJ
cyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4g
UlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4g
VGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBO
b3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNB
IEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4gVGhp
cyBJcyBOb3QgQW4gUlNBIEtleS4gVGhpcyBJcyBOb3QgQW4gUlNBIEtleS4uLi4gSXQgSXMgSnVz
dCBBIFJlZ3VsYXIgQmFzZTY0IEVuY29kZWQgU3RyaW5nLi4uCg==
------END FAKE PUBLIC KEY-----`),
				ServiceAccountID:       2,
				SelfPermissions:        nil,
				ImpersonatePermissions: nil,
				RedirectURI:            "/whereto",
			},
			wantErr: false,
		},
		{
			name: "register and get",
			client: oauthserver.Client{
				ID:                  2,
				ExternalServiceName: "The Best App Ever",
				ClientID:            "AnAlmostRandomClientID",
				Secret:              "ICannotKeepSecrets",
				GrantTypes:          "clients_credentials",
				PublicPem:           []byte(`test`),
				ServiceAccountID:    2,
				SelfPermissions:     nil,
				ImpersonatePermissions: []accesscontrol.Permission{
					{Action: "dashboards:create", Scope: "folders:*"},
					{Action: "dashboards:read", Scope: "folders:*"},
					{Action: "dashboards:read", Scope: "dashboards:*"},
					{Action: "dashboards:write", Scope: "folders:*"},
					{Action: "dashboards:write", Scope: "dashboards:*"},
				},
				RedirectURI: "/whereto",
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			err := s.RegisterExternalService(ctx, &tt.client)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			stored, err := s.GetExternalService(ctx, tt.client.ClientID)
			require.NoError(t, err)
			require.NotNil(t, stored)

			// Compare results
			perms := tt.client.ImpersonatePermissions
			storedPerms := stored.ImpersonatePermissions
			tt.client.ImpersonatePermissions = nil
			stored.ImpersonatePermissions = nil
			require.EqualValues(t, tt.client, *stored)
			require.ElementsMatch(t, perms, storedPerms)
		})
	}
}
