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
	s := &store{db: db.InitTestDB(t)}
	tests := []struct {
		name    string
		client  oauthserver.Client
		wantErr bool
	}{
		{
			name: "register without impersonate permissions and get",
			client: oauthserver.Client{
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

func TestStore_SaveExternalService(t *testing.T) {
	client1 := oauthserver.Client{
		ExternalServiceName:    "my-external-service",
		ClientID:               "ClientID",
		Secret:                 "Secret",
		GrantTypes:             "client_credentials",
		PublicPem:              []byte("test"),
		ServiceAccountID:       2,
		ImpersonatePermissions: []accesscontrol.Permission{},
		RedirectURI:            "/whereto",
	}
	client1WithPerm := client1
	client1WithPerm.ImpersonatePermissions = []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "folders:*"},
		{Action: "dashboards:read", Scope: "dashboards:*"},
	}
	client1WithNewSecrets := client1
	client1WithNewSecrets.ClientID = "NewClientID"
	client1WithNewSecrets.Secret = "NewSecret"
	client1WithNewSecrets.PublicPem = []byte("newtest")

	tests := []struct {
		name    string
		runs    []oauthserver.Client
		wantErr bool
	}{
		{
			name:    "error no name",
			runs:    []oauthserver.Client{{}},
			wantErr: true,
		},
		{
			name:    "simple register",
			runs:    []oauthserver.Client{client1},
			wantErr: false,
		},
		{
			name:    "no update",
			runs:    []oauthserver.Client{client1, client1},
			wantErr: false,
		},
		{
			name:    "add permissions",
			runs:    []oauthserver.Client{client1, client1WithPerm},
			wantErr: false,
		},
		{
			name:    "remove permissions",
			runs:    []oauthserver.Client{client1WithPerm, client1},
			wantErr: false,
		},
		{
			name:    "update id and secrets",
			runs:    []oauthserver.Client{client1, client1WithNewSecrets},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &store{db: db.InitTestDB(t)}
			for i := range tt.runs {
				err := s.SaveExternalService(context.Background(), &tt.runs[i])
				if tt.wantErr {
					require.Error(t, err)
					return
				}
				require.NoError(t, err)

				compareClientToStored(t, s, &tt.runs[i])
			}
		})
	}
}

func compareClientToStored(t *testing.T, s *store, wanted *oauthserver.Client) {
	ctx := context.Background()
	stored, err := s.GetExternalService(ctx, wanted.ClientID)
	require.NoError(t, err)
	require.NotNil(t, stored)

	// Reset ID so we can compare
	require.NotZero(t, stored.ID)
	stored.ID = 0

	// Compare permissions separately
	wantedPerms := wanted.ImpersonatePermissions
	storedPerms := stored.ImpersonatePermissions
	wanted.ImpersonatePermissions = nil
	stored.ImpersonatePermissions = nil
	require.EqualValues(t, *wanted, *stored)
	require.ElementsMatch(t, wantedPerms, storedPerms)
}
