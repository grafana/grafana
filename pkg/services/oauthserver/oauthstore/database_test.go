package oauthstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/oauthserver"
)

func TestStore_RegisterAndGetClient(t *testing.T) {
	s := &Store{db: db.InitTestDB(t)}
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
				ClientID:            "ANonRandomClientID",
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

			// Compare results
			compareClientToStored(t, s, &tt.client)
		})
	}
}

func TestStore_UpdateExternalService(t *testing.T) {
	s := &Store{db: db.InitTestDB(t)}

	client1 := &oauthserver.Client{
		ID:                     1,
		ExternalServiceName:    "The Worst App Ever",
		ClientID:               "ANonRandomClientID",
		Secret:                 "ICouldKeepSecrets",
		GrantTypes:             "clients_credentials",
		PublicPem:              []byte(`fake public key`),
		ServiceAccountID:       2,
		ImpersonatePermissions: nil,
		RedirectURI:            "/whereto",
	}
	err := s.RegisterExternalService(context.Background(), client1)
	require.NoError(t, err)

	newStr := func(v string) *string { return &v }
	newInt64 := func(v int64) *int64 { return &v }

	tests := []struct {
		name    string
		update  *oauthserver.UpdateClientCommand
		want    func() *oauthserver.Client
		wantErr bool
	}{
		{
			name: "error no previous",
			update: &oauthserver.UpdateClientCommand{
				ExternalServiceName: "Does Not Exist",
			},
			want:    nil,
			wantErr: true,
		},
		{
			name:    "error no name",
			update:  &oauthserver.UpdateClientCommand{},
			want:    nil,
			wantErr: true,
		},
		{
			name: "no update",
			update: &oauthserver.UpdateClientCommand{
				ExternalServiceName: client1.ExternalServiceName,
			},
			want:    func() *oauthserver.Client { return client1 },
			wantErr: false,
		},
		{
			// Note that this will update Client1 for the rest of the tests
			name: "add permissions",
			update: &oauthserver.UpdateClientCommand{
				ExternalServiceName: client1.ExternalServiceName,
				ImpersonatePermissions: []accesscontrol.Permission{
					{Action: "dashboards:create", Scope: "folders:*"},
					{Action: "dashboards:read", Scope: "folders:*"},
					{Action: "dashboards:read", Scope: "dashboards:*"},
					{Action: "dashboards:write", Scope: "folders:*"},
					{Action: "dashboards:write", Scope: "dashboards:*"},
				},
			},
			want: func() *oauthserver.Client {
				client := *client1
				client.ImpersonatePermissions = []accesscontrol.Permission{
					{Action: "dashboards:create", Scope: "folders:*"},
					{Action: "dashboards:read", Scope: "folders:*"},
					{Action: "dashboards:read", Scope: "dashboards:*"},
					{Action: "dashboards:write", Scope: "folders:*"},
					{Action: "dashboards:write", Scope: "dashboards:*"},
				}
				return &client
			},
			wantErr: false,
		},
		{
			// Note that this will update Client1 for the rest of the tests
			name: "remove permissions",
			update: &oauthserver.UpdateClientCommand{
				ExternalServiceName:    client1.ExternalServiceName,
				ImpersonatePermissions: []accesscontrol.Permission{},
			},
			want:    func() *oauthserver.Client { return client1 },
			wantErr: false,
		},
		{
			name: "update everything else",
			update: &oauthserver.UpdateClientCommand{
				ExternalServiceName: client1.ExternalServiceName,
				ClientID:            newStr("newID"),
				Secret:              newStr("newSecret"),
				PublicPem:           []byte("new public key"),
				RedirectURI:         newStr(""),
				ServiceAccountID:    newInt64(3),
				GrantTypes:          newStr("authorization_code"),
			},
			want: func() *oauthserver.Client {
				return &oauthserver.Client{
					ID:                  client1.ID,
					ExternalServiceName: client1.ExternalServiceName,
					ClientID:            "newID",
					Secret:              "newSecret",
					GrantTypes:          "authorization_code",
					PublicPem:           []byte("new public key"),
					ServiceAccountID:    3,
					RedirectURI:         "",
				}
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := s.UpdateExternalService(context.Background(), tt.update)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			// Compare results
			compareClientToStored(t, s, tt.want())
		})
	}
}

func compareClientToStored(t *testing.T, s *Store, wanted *oauthserver.Client) {
	ctx := context.Background()
	stored, err := s.GetExternalService(ctx, wanted.ClientID)
	require.NoError(t, err)
	require.NotNil(t, stored)

	wantedPerms := wanted.ImpersonatePermissions
	storedPerms := stored.ImpersonatePermissions
	wanted.ImpersonatePermissions = nil
	stored.ImpersonatePermissions = nil
	require.EqualValues(t, *wanted, *stored)
	require.ElementsMatch(t, wantedPerms, storedPerms)
}
