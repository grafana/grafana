package store

import (
	"context"
	"errors"
	"testing"

	"github.com/go-jose/go-jose/v3"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestStore_RegisterAndGetClient(t *testing.T) {
	s := &store{db: db.InitTestDB(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagExternalServiceAuth}})}
	tests := []struct {
		name    string
		client  oauthserver.OAuthExternalService
		wantErr bool
	}{
		{
			name: "register and get",
			client: oauthserver.OAuthExternalService{
				Name:       "The Worst App Ever",
				ClientID:   "ANonRandomClientID",
				Secret:     "ICouldKeepSecrets",
				GrantTypes: "clients_credentials",
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
			name: "register with impersonate permissions and get",
			client: oauthserver.OAuthExternalService{
				Name:             "The Best App Ever",
				ClientID:         "AnAlmostRandomClientID",
				Secret:           "ICannotKeepSecrets",
				GrantTypes:       "clients_credentials",
				PublicPem:        []byte(`test`),
				ServiceAccountID: 2,
				SelfPermissions:  nil,
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
		{
			name: "register with audiences and get",
			client: oauthserver.OAuthExternalService{
				Name:             "The Most Normal App Ever",
				ClientID:         "AnAlmostRandomClientIDAgain",
				Secret:           "ICanKeepSecretsEventually",
				GrantTypes:       "clients_credentials",
				PublicPem:        []byte(`test`),
				ServiceAccountID: 2,
				SelfPermissions:  nil,
				Audiences:        "https://oauth.test/,https://sub.oauth.test/",
				RedirectURI:      "/whereto",
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
	client1 := oauthserver.OAuthExternalService{
		Name:                   "my-external-service",
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

	client1WithAud := client1
	client1WithAud.Audiences = "https://oauth.test/,https://sub.oauth.test/"

	tests := []struct {
		name    string
		runs    []oauthserver.OAuthExternalService
		wantErr bool
	}{
		{
			name:    "error no name",
			runs:    []oauthserver.OAuthExternalService{{}},
			wantErr: true,
		},
		{
			name:    "simple register",
			runs:    []oauthserver.OAuthExternalService{client1},
			wantErr: false,
		},
		{
			name:    "no update",
			runs:    []oauthserver.OAuthExternalService{client1, client1},
			wantErr: false,
		},
		{
			name:    "add permissions",
			runs:    []oauthserver.OAuthExternalService{client1, client1WithPerm},
			wantErr: false,
		},
		{
			name:    "remove permissions",
			runs:    []oauthserver.OAuthExternalService{client1WithPerm, client1},
			wantErr: false,
		},
		{
			name:    "update id and secrets",
			runs:    []oauthserver.OAuthExternalService{client1, client1WithNewSecrets},
			wantErr: false,
		},
		{
			name:    "update audience",
			runs:    []oauthserver.OAuthExternalService{client1, client1WithAud},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &store{db: db.InitTestDB(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagExternalServiceAuth}})}
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
	client1 := oauthserver.OAuthExternalService{
		Name:                   "my-external-service",
		ClientID:               "ClientID",
		Secret:                 "Secret",
		GrantTypes:             "client_credentials",
		PublicPem:              []byte("test"),
		ServiceAccountID:       2,
		ImpersonatePermissions: []accesscontrol.Permission{},
		RedirectURI:            "/whereto",
	}
	client2 := oauthserver.OAuthExternalService{
		Name:             "my-external-service-2",
		ClientID:         "ClientID2",
		Secret:           "Secret2",
		GrantTypes:       "client_credentials,urn:ietf:params:grant-type:jwt-bearer",
		PublicPem:        []byte("test2"),
		ServiceAccountID: 3,
		Audiences:        "https://oauth.test/,https://sub.oauth.test/",
		ImpersonatePermissions: []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
		},
		RedirectURI: "/whereto",
	}
	s := &store{db: db.InitTestDB(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagExternalServiceAuth}})}
	require.NoError(t, s.SaveExternalService(context.Background(), &client1))
	require.NoError(t, s.SaveExternalService(context.Background(), &client2))

	tests := []struct {
		name    string
		search  string
		want    *oauthserver.OAuthExternalService
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
	createClient := func(clientID string, publicPem string) *oauthserver.OAuthExternalService {
		return &oauthserver.OAuthExternalService{
			Name:                   "my-external-service",
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
		name        string
		client      *oauthserver.OAuthExternalService
		clientID    string
		want        *jose.JSONWebKey
		wantKeyType string
		wantErr     bool
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
			name:     "should return the JSON Web Key ES256",
			clientID: clientID,
			client: createClient(clientID, `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbsGtoGJTopAIbhqy49/vyCJuDot+
mgGaC8vUIigFQVsVB+v/HZ4yG1Rcvysig+tyNk1dZQpozpFc2dGmzHlGhw==
-----END PUBLIC KEY-----`),
			wantKeyType: oauthserver.ES256,
			wantErr:     false,
		},
		{
			name:     "should return the JSON Web Key RS256",
			clientID: clientID,
			client: createClient(clientID, `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEAxkly/cHvsxd6EcShGUlFAB5lIMlIbGRocCVWbIM26f6pnGr+gCNv
s365DQdQ/jUjF8bSEQM+EtjGlv2Y7Jm7dQROpPzX/1M+53Us/Gl138UtAEgL5ZKe
SKN5J/f9Nx4wkgb99v2Bt0nz6xv+kSJwgR0o8zi8shDR5n7a5mTdlQe2NOixzWlT
vnpp6Tm+IE+XyXXcrCr01I9Rf+dKuYOPSJ1K3PDgFmmGvsLcjRCCK9EftfY0keU+
IP+sh8ewNxc6KcaLBXm3Tadb1c/HyuMi6FyYw7s9m8tyAvI1CMBAcXqLIEaRgNrc
vuO8AU0bVoUmYMKhozkcCYHudkeS08hEjQIDAQAB
-----END RSA PUBLIC KEY-----`),
			wantKeyType: oauthserver.RS256,
			wantErr:     false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := &store{db: db.InitTestDB(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagExternalServiceAuth}})}
			require.NoError(t, s.SaveExternalService(context.Background(), tc.client))

			webKey, err := s.GetExternalServicePublicKey(context.Background(), tc.clientID)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.Equal(t, tc.wantKeyType, webKey.Algorithm)
		})
	}
}

func TestStore_RemoveExternalService(t *testing.T) {
	ctx := context.Background()
	client1 := oauthserver.OAuthExternalService{
		Name:                   "my-external-service",
		ClientID:               "ClientID",
		ImpersonatePermissions: []accesscontrol.Permission{},
	}
	client2 := oauthserver.OAuthExternalService{
		Name:     "my-external-service-2",
		ClientID: "ClientID2",
		ImpersonatePermissions: []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
		},
	}

	// Init store
	s := &store{db: db.InitTestDB(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagExternalServiceAuth}})}
	require.NoError(t, s.SaveExternalService(context.Background(), &client1))
	require.NoError(t, s.SaveExternalService(context.Background(), &client2))

	// Check presence of clients in store
	getState := func(t *testing.T) map[string]bool {
		client, err := s.GetExternalService(ctx, "ClientID")
		if err != nil && !errors.Is(err, oauthserver.ErrClientNotFound) {
			require.Fail(t, "error fetching client")
		}

		client2, err := s.GetExternalService(ctx, "ClientID2")
		if err != nil && !errors.Is(err, oauthserver.ErrClientNotFound) {
			require.Fail(t, "error fetching client")
		}

		return map[string]bool{
			"ClientID":  client != nil,
			"ClientID2": client2 != nil,
		}
	}

	tests := []struct {
		name    string
		id      string
		state   map[string]bool
		wantErr bool
	}{
		{
			name:    "no id provided",
			state:   map[string]bool{"ClientID": true, "ClientID2": true},
			wantErr: true,
		},
		{
			name:    "not found",
			id:      "ClientID3",
			state:   map[string]bool{"ClientID": true, "ClientID2": true},
			wantErr: false,
		},
		{
			name:    "remove client 2",
			id:      "ClientID2",
			state:   map[string]bool{"ClientID": true, "ClientID2": false},
			wantErr: false,
		},
		{
			name:    "remove client 1",
			id:      "ClientID",
			state:   map[string]bool{"ClientID": false, "ClientID2": false},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s.DeleteExternalService(ctx, tt.id)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.EqualValues(t, tt.state, getState(t))
		})
	}
}

func Test_store_GetExternalServiceNames(t *testing.T) {
	ctx := context.Background()
	client1 := oauthserver.OAuthExternalService{
		Name:                   "my-external-service",
		ClientID:               "ClientID",
		ImpersonatePermissions: []accesscontrol.Permission{},
	}
	client2 := oauthserver.OAuthExternalService{
		Name:     "my-external-service-2",
		ClientID: "ClientID2",
		ImpersonatePermissions: []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
		},
	}

	// Init store
	s := &store{db: db.InitTestDB(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagExternalServiceAuth}})}
	require.NoError(t, s.SaveExternalService(context.Background(), &client1))
	require.NoError(t, s.SaveExternalService(context.Background(), &client2))

	got, err := s.GetExternalServiceNames(ctx)
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"my-external-service", "my-external-service-2"}, got)
}

func compareClientToStored(t *testing.T, s *store, wanted *oauthserver.OAuthExternalService) {
	ctx := context.Background()
	stored, err := s.GetExternalService(ctx, wanted.ClientID)
	require.NoError(t, err)
	require.NotNil(t, stored)

	compareClients(t, stored, wanted)
}

func compareClients(t *testing.T, stored *oauthserver.OAuthExternalService, wanted *oauthserver.OAuthExternalService) {
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
