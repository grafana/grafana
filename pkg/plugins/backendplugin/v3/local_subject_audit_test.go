package v3

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"
)

func auditSubjectRequest() authnlib.TokenExchangeRequest {
	return authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, Subject: &authnlib.TokenExchangeSubject{
		Sub: "user:42", Identifier: "uid-42", Type: "user", Namespace: "default",
	}}
}

func auditSubjectPolicy() LocalAccessPolicy {
	return LocalAccessPolicy{PluginID: "audit-app", Audiences: []string{"grafana"}, Permissions: []string{"users:create"},
		SubjectSigning: &LocalSubjectPolicy{DelegatedPermissions: []string{"datasources:read", "datasources:write"}},
	}
}

func TestLocalSubjectTokenLifetime(t *testing.T) {
	for _, tc := range []struct {
		name      string
		maximum   time.Duration
		requested *int
		want      time.Duration
	}{
		{name: "default", want: 5 * time.Minute},
		{name: "default unaffected by maximum", maximum: time.Hour, want: 5 * time.Minute},
		{name: "one second", requested: new(1), want: time.Second},
		{name: "shorter", requested: new(60), want: time.Minute},
		{name: "explicit default", requested: new(300), want: 5 * time.Minute},
		{name: "longer", maximum: time.Hour, requested: new(900), want: 15 * time.Minute},
		{name: "exact maximum", maximum: time.Hour, requested: new(3600), want: time.Hour},
		{name: "zero", requested: new(0)},
		{name: "negative", requested: new(-1)},
		{name: "above default maximum", requested: new(301)},
		{name: "above configured maximum", maximum: time.Hour, requested: new(3601)},
		{name: "duration overflow", maximum: time.Hour, requested: new(int(^uint(0) >> 1))},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				e, err := newLocalExchanger()
				require.NoError(t, err)
				policy := auditSubjectPolicy()
				policy.SubjectSigning.MaxTokenLifetime = tc.maximum
				req := auditSubjectRequest()
				req.ExpiresIn = tc.requested
				token, err := e.signForPolicy(context.Background(), policy, req)
				if tc.want == 0 {
					require.ErrorIs(t, err, ErrLocalAccessDenied)
					require.ErrorContains(t, err, "expiresIn")
					require.Empty(t, token)
					return
				}
				require.NoError(t, err)
				v := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, e.keys)
				claims, err := v.Verify(context.Background(), token)
				require.NoError(t, err)
				require.Equal(t, tc.want, claims.Expiry.Time().Sub(claims.IssuedAt.Time()))
				time.Sleep(tc.want - time.Second)
				_, err = v.Verify(context.Background(), token)
				require.NoError(t, err)
				// authlib uses go-jose's default clock-skew allowance.
				time.Sleep(jwt.DefaultLeeway + 2*time.Second)
				_, err = v.Verify(context.Background(), token)
				require.ErrorIs(t, err, authnlib.ErrExpiredToken)
			})
		})
	}
}

func TestLocalSubjectMetadataAndPolicyIsolation(t *testing.T) {
	e, err := newLocalExchanger()
	require.NoError(t, err)
	policy := auditSubjectPolicy()
	req := auditSubjectRequest()
	req.Subject.Email = "asserted@example.test"
	req.Subject.EmailVerified = true
	req.Subject.Username = "asserted"
	req.Subject.DisplayName = "asserted"
	req.Subject.AuthenticatedBy = "asserted"
	req.Subject.Role = "Admin"
	req.Subject.Groups = []string{"asserted"}
	req.RestrictedDelegatedPermissions = []string{"datasources:read", "users:create"}
	token, err := e.signForPolicy(context.Background(), policy, req)
	require.NoError(t, err)
	v := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, e.keys)
	claims, err := v.Verify(context.Background(), token)
	require.NoError(t, err)
	require.Empty(t, claims.Rest.Permissions)
	require.Empty(t, claims.Rest.Scopes)
	require.Empty(t, claims.Rest.ServiceIdentity)
	require.Equal(t, []string{"datasources:read"}, claims.Rest.DelegatedPermissions)
	require.Equal(t, &authnlib.ActorClaims{Subject: "user:42", IDTokenClaims: authnlib.IDTokenClaims{
		Identifier: "uid-42", Type: "user", Namespace: "default",
	}}, claims.Rest.Actor)
	require.Equal(t, []string{"datasources:read", "datasources:write"}, policy.SubjectSigning.DelegatedPermissions)
}

func TestLocalSubjectConcurrentNarrowing(t *testing.T) {
	e, err := newLocalExchanger()
	require.NoError(t, err)
	policy := auditSubjectPolicy()
	v := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, e.keys)
	var wg sync.WaitGroup
	for i := range 48 {
		wg.Go(func() {
			req := auditSubjectRequest()
			want := "datasources:read"
			if i%2 != 0 {
				want = "datasources:write"
			}
			req.RestrictedDelegatedPermissions = []string{want}
			token, err := e.signForPolicy(context.Background(), policy, req)
			if err != nil {
				t.Errorf("sign: %v", err)
				return
			}
			claims, err := v.Verify(context.Background(), token)
			if err != nil {
				t.Errorf("verify: %v", err)
				return
			}
			if len(claims.Rest.DelegatedPermissions) != 1 || claims.Rest.DelegatedPermissions[0] != want {
				t.Errorf("delegation differs between concurrent requests: %v; want %s", claims.Rest.DelegatedPermissions, want)
			}
		})
	}
	wg.Wait()
	require.Equal(t, []string{"datasources:read", "datasources:write"}, policy.SubjectSigning.DelegatedPermissions)
}

func TestLocalSubjectRejectsNoncanonicalIdentity(t *testing.T) {
	for _, sub := range []string{"", "user:0", "user:-1", "user:+42", "user:042", "user: 42", "user:42 ", "user:4.2", "user:4e2", "user:9223372036854775808", "user:", "user:42:43", "service-account:42"} {
		t.Run(sub, func(t *testing.T) {
			req := auditSubjectRequest()
			req.Subject.Sub = sub
			_, _, err := assertedSubject(auditSubjectPolicy().SubjectSigning, req)
			require.ErrorIs(t, err, ErrLocalAccessDenied)
		})
	}
	for _, uid := range []string{"", " ", "\t\n"} {
		req := auditSubjectRequest()
		req.Subject.Identifier = uid
		_, _, err := assertedSubject(auditSubjectPolicy().SubjectSigning, req)
		require.ErrorIs(t, err, ErrLocalAccessDenied)
	}
}

func TestLocalSubjectVerificationBoundaries(t *testing.T) {
	e, err := newLocalExchanger()
	require.NoError(t, err)
	token, err := e.signForPolicy(context.Background(), auditSubjectPolicy(), auditSubjectRequest())
	require.NoError(t, err)
	v := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, e.keys)
	_, err = v.Verify(context.Background(), token)
	require.NoError(t, err)
	for _, part := range []int{0, 1, 2} {
		parts := strings.Split(token, ".")
		decoded, err := base64.RawURLEncoding.DecodeString(parts[part])
		require.NoError(t, err)
		if part == 2 {
			decoded[0] ^= 1
		} else {
			var value map[string]any
			require.NoError(t, json.Unmarshal(decoded, &value))
			if part == 0 {
				value["kid"] = "unknown-key"
			} else {
				value["namespace"] = "org-2"
			}
			decoded, err = json.Marshal(value)
			require.NoError(t, err)
		}
		parts[part] = base64.RawURLEncoding.EncodeToString(decoded)
		_, err = v.Verify(context.Background(), strings.Join(parts, "."))
		require.Error(t, err, "modified JWT part %d must fail verification", part)
	}
	wrongAudience := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"another-service"}}, e.keys)
	_, err = wrongAudience.Verify(context.Background(), token)
	require.ErrorIs(t, err, authnlib.ErrInvalidAudience)
	otherProcess, err := newLocalExchanger()
	require.NoError(t, err)
	otherVerifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, otherProcess.keys)
	_, err = otherVerifier.Verify(context.Background(), token)
	require.Error(t, err, "a separate process has a different signing key even though its key ID is the same")
}
