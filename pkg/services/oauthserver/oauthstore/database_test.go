package oauthstore

import (
	"context"
	"testing"

	"github.com/go-jose/go-jose/v3"
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

func TestStore_GetExternalServiceByName(t *testing.T) {
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
	client2 := oauthserver.Client{
		ExternalServiceName: "my-external-service-2",
		ClientID:            "ClientID2",
		Secret:              "Secret2",
		GrantTypes:          "client_credentials,urn:ietf:params:grant-type:jwt-bearer",
		PublicPem:           []byte("test2"),
		ServiceAccountID:    3,
		ImpersonatePermissions: []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
		},
		RedirectURI: "/whereto",
	}
	s := &store{db: db.InitTestDB(t)}
	require.NoError(t, s.SaveExternalService(context.Background(), &client1))
	require.NoError(t, s.SaveExternalService(context.Background(), &client2))

	tests := []struct {
		name    string
		search  string
		want    *oauthserver.Client
		wantErr bool
	}{
		{
			name:    "no name provided",
			search:  "",
			want:    nil,
			wantErr: true,
		},
		{
			name:    "not found",
			search:  "unknown-external-service",
			want:    nil,
			wantErr: true,
		},
		{
			name:    "search client 1 by name",
			search:  "my-external-service",
			want:    &client1,
			wantErr: false,
		},
		{
			name:    "search client 2 by name",
			search:  "my-external-service-2",
			want:    &client2,
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stored, err := s.GetExternalServiceByName(context.Background(), tt.search)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			compareClients(t, stored, tt.want)
		})
	}
}

func TestStore_GetExternalServicePublicKey(t *testing.T) {
	clientID := "ClientID"
	createClient := func(clientID string, publicPem string) *oauthserver.Client {
		return &oauthserver.Client{
			ExternalServiceName:    "my-external-service",
			ClientID:               clientID,
			Secret:                 "Secret",
			GrantTypes:             "client_credentials",
			PublicPem:              []byte(publicPem),
			ServiceAccountID:       2,
			ImpersonatePermissions: []accesscontrol.Permission{},
			RedirectURI:            "/whereto",
		}
	}

	testCases := []struct {
		name     string
		client   *oauthserver.Client
		clientID string
		want     *jose.JSONWebKey
		wantErr  bool
	}{
		{
			name:     "should return an error when clientID is empty",
			clientID: "",
			client:   createClient(clientID, ""),
			want:     nil,
			wantErr:  true,
		},
		{
			name:     "should return an error when the client was not found",
			clientID: "random",
			client:   createClient(clientID, ""),
			want:     nil,
			wantErr:  true,
		},
		{
			name:     "should return an error when PublicPem is not valid",
			clientID: clientID,
			client:   createClient(clientID, ""),
			want:     nil,
			wantErr:  true,
		},
		{
			name:     "should return the JSON Web Key",
			clientID: clientID,
			client: createClient(clientID, `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbsGtoGJTopAIbhqy49/vyCJuDot+
mgGaC8vUIigFQVsVB+v/HZ4yG1Rcvysig+tyNk1dZQpozpFc2dGmzHlGhw==
-----END PUBLIC KEY-----`),
			wantErr: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := &store{db: db.InitTestDB(t)}
			require.NoError(t, s.SaveExternalService(context.Background(), tc.client))

			webKey, err := s.GetExternalServicePublicKey(context.Background(), tc.clientID)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.Equal(t, oauthserver.ES256, webKey.Algorithm)

		})
	}
}

func compareClientToStored(t *testing.T, s *store, wanted *oauthserver.Client) {
	ctx := context.Background()
	stored, err := s.GetExternalService(ctx, wanted.ClientID)
	require.NoError(t, err)
	require.NotNil(t, stored)

	compareClients(t, stored, wanted)
}

func compareClients(t *testing.T, stored *oauthserver.Client, wanted *oauthserver.Client) {
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
