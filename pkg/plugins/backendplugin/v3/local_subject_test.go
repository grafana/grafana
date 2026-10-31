package v3

import (
	"context"
	"encoding/json"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
)

func TestLocalSubjectSigning(t *testing.T) {
	e, err := newLocalExchanger()
	require.NoError(t, err)
	policy := LocalAccessPolicy{
		PluginID: "obo-poc-app", Audiences: []string{"grafana"},
		Permissions:    []string{"users:write"},
		SubjectSigning: &LocalSubjectPolicy{DelegatedPermissions: []string{"datasources:read", "datasources:write"}},
	}
	request := func() authnlib.TokenExchangeRequest {
		return authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, Subject: &authnlib.TokenExchangeSubject{
			Sub: "user:42", Identifier: "user-uid", Type: "user", Namespace: "default", Role: "Admin", Groups: []string{"untrusted-group"},
		}}
	}
	verifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, e.keys)
	for _, typ := range []types.IdentityType{types.TypeUser, types.TypeServiceAccount} {
		t.Run(string(typ), func(t *testing.T) {
			req := request()
			req.Subject.Type = string(typ)
			req.Subject.Sub = types.NewTypeID(typ, "42")
			token, err := e.signForPolicy(context.Background(), policy, req)
			require.NoError(t, err)
			claims, err := verifier.Verify(context.Background(), token)
			require.NoError(t, err)
			require.Equal(t, "access-policy:obo-poc-app", claims.Subject)
			require.Equal(t, "default", claims.Rest.Namespace)
			require.Empty(t, claims.Rest.Permissions)
			require.Equal(t, policy.SubjectSigning.DelegatedPermissions, claims.Rest.DelegatedPermissions)
			require.True(t, claims.Rest.IsOnBehalfOfUser())
			require.Equal(t, req.Subject.Sub, authnlib.NewAccessTokenAuthInfo(*claims).GetSubject())
			require.Equal(t, req.Subject.Identifier, authnlib.NewAccessTokenAuthInfo(*claims).GetIdentifier())
			require.Empty(t, claims.Rest.Actor.Role)
			require.Empty(t, claims.Rest.Actor.Groups)
			require.Equal(t, localTokenTTL, claims.Expiry.Time().Sub(claims.IssuedAt.Time()))
		})
	}
	t.Run("restriction cannot add permissions", func(t *testing.T) {
		req := request()
		req.RestrictedDelegatedPermissions = []string{"datasources:read", "users:write"}
		token, err := e.signForPolicy(context.Background(), policy, req)
		require.NoError(t, err)
		claims, err := verifier.Verify(context.Background(), token)
		require.NoError(t, err)
		require.Equal(t, []string{"datasources:read"}, claims.Rest.DelegatedPermissions)
	})
	cases := map[string]func(*authnlib.TokenExchangeRequest){
		"wrong audience":         func(r *authnlib.TokenExchangeRequest) { r.Audiences = []string{"other"} },
		"both subject forms":     func(r *authnlib.TokenExchangeRequest) { r.SubjectToken = "any-token" },
		"namespace mismatch":     func(r *authnlib.TokenExchangeRequest) { r.Subject.Namespace = "org-2" },
		"wildcard namespace":     func(r *authnlib.TokenExchangeRequest) { r.Namespace = "*"; r.Subject.Namespace = "*" },
		"cloud namespace":        func(r *authnlib.TokenExchangeRequest) { r.Namespace = "stacks-1"; r.Subject.Namespace = "stacks-1" },
		"noncanonical namespace": func(r *authnlib.TokenExchangeRequest) { r.Namespace = "org-02"; r.Subject.Namespace = "org-02" },
		"missing UID":            func(r *authnlib.TokenExchangeRequest) { r.Subject.Identifier = "" },
		"UID in subject":         func(r *authnlib.TokenExchangeRequest) { r.Subject.Sub = "user:abc" },
		"zero subject":           func(r *authnlib.TokenExchangeRequest) { r.Subject.Sub = "user:0" },
		"noncanonical subject":   func(r *authnlib.TokenExchangeRequest) { r.Subject.Sub = "user:042" },
		"type mismatch":          func(r *authnlib.TokenExchangeRequest) { r.Subject.Type = "service-account" },
		"unsupported type":       func(r *authnlib.TokenExchangeRequest) { r.Subject.Sub = "render:42"; r.Subject.Type = "render" },
		"no effective grant":     func(r *authnlib.TokenExchangeRequest) { r.RestrictedDelegatedPermissions = []string{"users:write"} },
		"expiry above maximum":   func(r *authnlib.TokenExchangeRequest) { expiry := 86400; r.ExpiresIn = &expiry },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			req := request()
			mutate(&req)
			_, err := e.signForPolicy(context.Background(), policy, req)
			require.Error(t, err)
		})
	}
	t.Run("disabled by default", func(t *testing.T) {
		denied := policy
		denied.SubjectSigning = nil
		_, err := e.signForPolicy(context.Background(), denied, request())
		require.ErrorIs(t, err, ErrLocalAccessDenied)
	})
}

func TestLocalSubjectRestrictionContract(t *testing.T) {
	e, err := newLocalExchanger()
	require.NoError(t, err)
	policy := LocalAccessPolicy{
		PluginID: "allowed-app", Audiences: []string{"grafana"},
		SubjectSigning: &LocalSubjectPolicy{DelegatedPermissions: []string{"datasources:read", "datasources:write"}},
	}
	for _, tt := range []struct {
		name string
		body string
		want []string
	}{
		{name: "omitted", body: `{}`, want: []string{"datasources:read", "datasources:write"}},
		{name: "null", body: `{"restrictedDelegatedPermissions":null}`, want: []string{"datasources:read", "datasources:write"}},
		{name: "empty", body: `{"restrictedDelegatedPermissions":[]}`},
		{name: "subset", body: `{"restrictedDelegatedPermissions":["datasources:read"]}`, want: []string{"datasources:read"}},
		{name: "mixed", body: `{"restrictedDelegatedPermissions":["datasources:read","users:create"]}`, want: []string{"datasources:read"}},
		{name: "no overlap", body: `{"restrictedDelegatedPermissions":["users:create"]}`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			var req authnlib.TokenExchangeRequest
			require.NoError(t, json.Unmarshal([]byte(tt.body), &req))
			req.Namespace = "default"
			req.Audiences = []string{"grafana"}
			req.Subject = &authnlib.TokenExchangeSubject{Sub: "user:42", Identifier: "uid-42", Type: "user", Namespace: "default"}
			token, err := e.signForPolicy(context.Background(), policy, req)
			if tt.want == nil {
				require.ErrorIs(t, err, ErrLocalAccessDenied)
				require.Empty(t, token)
				return
			}
			require.NoError(t, err)
			verifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, e.keys)
			claims, err := verifier.Verify(context.Background(), token)
			require.NoError(t, err)
			require.Equal(t, tt.want, claims.Rest.DelegatedPermissions)
		})
	}
}
