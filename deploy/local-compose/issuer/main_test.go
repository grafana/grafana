package main

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
)

type keyRetriever struct{ key *jose.JSONWebKey }

func (r keyRetriever) Get(context.Context, string) (*jose.JSONWebKey, error) {
	return &jose.JSONWebKey{Key: &r.key.Key.(*ecdsa.PrivateKey).PublicKey, Algorithm: string(jose.ES256), KeyID: keyID, Use: "sig"}, nil
}

func testIssuer(t *testing.T) *tokenIssuer {
	t.Helper()
	key, err := loadKey(filepath.Join(t.TempDir(), "es256.key"))
	if err != nil {
		t.Fatal(err)
	}
	return &tokenIssuer{key: key}
}

func subjectRequest(t *testing.T, path string, req authn.TokenExchangeRequest, i *tokenIssuer) *httptest.ResponseRecorder {
	t.Helper()
	var payload any = req
	if path == "/sign/id-token" {
		payload = remoteIDTokenRequest{Namespace: req.Namespace, Claims: jwt.Claims{Subject: subjectValue(req.Subject), Audience: jwt.Audience(req.Audiences), IssuedAt: jwt.NewNumericDate(time.Now()), Expiry: jwt.NewNumericDate(nowPlus(req.ExpiresIn))}, Extra: authn.IDTokenClaims{Identifier: req.Subject.Identifier, Type: identityType(req.Subject.Type), Namespace: req.Namespace, AuthenticatedBy: req.Subject.AuthenticatedBy, Email: req.Subject.Email, EmailVerified: req.Subject.EmailVerified, Username: req.Subject.Username, DisplayName: req.Subject.DisplayName, Role: req.Subject.Role, Groups: req.Subject.Groups}}
	}
	b, _ := json.Marshal(payload)
	r := httptest.NewRequest("POST", path, strings.NewReader(string(b)))
	r.Header.Set("Authorization", "Bearer "+bearer)
	w := httptest.NewRecorder()
	if path == "/sign/id-token" {
		i.idToken(w, r)
	} else {
		i.accessToken(w, r)
	}
	return w
}

func tokenFrom(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	if w.Code != 200 {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var v response
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatal(err)
	}
	return v.Data["token"]
}

func TestTokenExchangeUsesAuthlibTypesAndVerifiers(t *testing.T) {
	i := testIssuer(t)
	s := &authn.TokenExchangeSubject{Identifier: "1", Type: "user", Namespace: "stacks-11", Username: "admin", Role: "Admin"}
	idToken := tokenFrom(t, subjectRequest(t, "/sign/id-token", authn.TokenExchangeRequest{Namespace: "stacks-11", Audiences: []string{"error-tracking.grafana.app"}, Subject: s}, i))
	if strings.Count(idToken, ".") != 2 {
		t.Fatalf("ID token is not compact JWT: %q", idToken)
	}
	idClaims, err := authn.NewIDTokenVerifier(authn.VerifierConfig{AllowedAudiences: jwt.Audience{"error-tracking.grafana.app"}}, keyRetriever{i.key}).Verify(t.Context(), idToken)
	if err != nil {
		t.Fatal(err)
	}
	if idClaims.Issuer != issuerName || idClaims.Rest.Namespace != "stacks-11" || idClaims.Rest.Username != "admin" {
		t.Fatalf("unexpected ID claims: %+v", idClaims)
	}

	atToken := tokenFrom(t, subjectRequest(t, "/sign/access-token", authn.TokenExchangeRequest{Namespace: "stacks-11", Audiences: []string{"error-tracking.grafana.app"}, SubjectToken: idToken}, i))
	atClaims, err := authn.NewAccessTokenVerifier(authn.VerifierConfig{AllowedAudiences: jwt.Audience{"error-tracking.grafana.app"}}, keyRetriever{i.key}).Verify(t.Context(), atToken)
	if err != nil {
		t.Fatal(err)
	}
	if atClaims.Rest.Namespace != "stacks-11" || len(atClaims.Rest.Permissions) != 2 || len(atClaims.Rest.DelegatedPermissions) != 2 {
		t.Fatalf("unexpected access claims: %+v", atClaims.Rest)
	}
	server := httptest.NewServer(http.HandlerFunc(i.accessToken))
	defer server.Close()
	client, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{Token: bearer, TokenExchangeURL: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	clientResult, err := client.Exchange(t.Context(), authn.TokenExchangeRequest{Namespace: "stacks-11", Audiences: []string{"error-tracking.grafana.app"}, SubjectToken: idToken})
	if err != nil {
		t.Fatal(err)
	}
	if clientResult.Token == "" {
		t.Fatal("authlib client returned empty token")
	}
}

func TestIDTokenAcceptsExternalSignerWireShape(t *testing.T) {
	i := testIssuer(t)
	expires := jwt.NewNumericDate(time.Now().Add(time.Hour))
	b, err := json.Marshal(remoteIDTokenRequest{
		Namespace: "stacks-11",
		Claims:    jwt.Claims{Subject: "user:1", Audience: jwt.Audience{"org:1"}, Expiry: expires},
		Extra:     authn.IDTokenClaims{Identifier: "dfyxuhncd12ioe", Type: "user", Username: "admin", Role: "Admin"},
	})
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("POST", "/sign/id-token", strings.NewReader(string(b)))
	r.Header.Set("Authorization", "Bearer "+bearer)
	w := httptest.NewRecorder()
	i.idToken(w, r)
	token := tokenFrom(t, w)
	claims, err := authn.NewIDTokenVerifier(authn.VerifierConfig{AllowedAudiences: jwt.Audience{"org:1"}}, keyRetriever{i.key}).Verify(t.Context(), token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Rest.Namespace != "stacks-11" || claims.Rest.Identifier != "dfyxuhncd12ioe" || claims.Rest.Username != "admin" {
		t.Fatalf("unexpected claims: %+v", claims.Rest)
	}
}

func TestAccessTokenPreservesNumericSubjectWithOpaqueUID(t *testing.T) {
	i := testIssuer(t)
	id := tokenFrom(t, subjectRequest(t, "/sign/id-token", authn.TokenExchangeRequest{
		Namespace: "stacks-11",
		Audiences: []string{"org:1"},
		Subject:   &authn.TokenExchangeSubject{Sub: "user:1", Identifier: "dfyxuhncd12ioe", Type: "user", Namespace: "stacks-11"},
	}, i))
	at := tokenFrom(t, subjectRequest(t, "/sign/access-token", authn.TokenExchangeRequest{
		Namespace:    "stacks-11",
		Audiences:    []string{"error-tracking.grafana.app"},
		SubjectToken: id,
	}, i))
	claims, err := authn.NewAccessTokenVerifier(authn.VerifierConfig{AllowedAudiences: jwt.Audience{"error-tracking.grafana.app"}}, keyRetriever{i.key}).Verify(t.Context(), at)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Rest.Actor == nil || claims.Rest.Actor.Subject != "user:1" || claims.Rest.Actor.Identifier != "dfyxuhncd12ioe" {
		t.Fatalf("numeric subject or opaque UID was not preserved: %+v", claims.Rest.Actor)
	}
}

func TestSubjectTokenSignatureExpiryAndNamespaceAreVerified(t *testing.T) {
	i := testIssuer(t)
	s := &authn.TokenExchangeSubject{Identifier: "1", Type: "user", Namespace: "stacks-11"}
	id := tokenFrom(t, subjectRequest(t, "/sign/id-token", authn.TokenExchangeRequest{Namespace: "stacks-11", Audiences: []string{"grafana"}, Subject: s}, i))
	parts := strings.Split(id, ".")
	bad := parts[0] + "." + "x" + parts[1][1:] + "." + parts[2]
	if w := subjectRequest(t, "/sign/access-token", authn.TokenExchangeRequest{Namespace: "stacks-11", Audiences: []string{"grafana"}, SubjectToken: bad}, i); w.Code != 400 {
		t.Fatalf("bad signature status %d", w.Code)
	}
	if w := subjectRequest(t, "/sign/access-token", authn.TokenExchangeRequest{Namespace: "stacks-22", Audiences: []string{"grafana"}, SubjectToken: id}, i); w.Code != 400 {
		t.Fatalf("namespace status %d", w.Code)
	}
	expiredClaims := jwt.Claims{Issuer: issuerName, Subject: "user:1", Audience: jwt.Audience{"grafana"}, IssuedAt: jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)), Expiry: jwt.NewNumericDate(time.Now().Add(-time.Hour))}
	expired, err := i.sign(authn.TokenTypeID, expiredClaims, authn.IDTokenClaims{Identifier: "1", Type: "user", Namespace: "stacks-11"})
	if err != nil {
		t.Fatal(err)
	}
	if w := subjectRequest(t, "/sign/access-token", authn.TokenExchangeRequest{Namespace: "stacks-11", Audiences: []string{"grafana"}, SubjectToken: expired}, i); w.Code != 400 {
		t.Fatalf("expired status %d", w.Code)
	}
	missingExpiry, err := i.sign(authn.TokenTypeID, jwt.Claims{Issuer: issuerName, Subject: "user:1", Audience: jwt.Audience{"grafana"}}, authn.IDTokenClaims{Identifier: "1", Type: "user", Namespace: "stacks-11"})
	if err != nil {
		t.Fatal(err)
	}
	if w := subjectRequest(t, "/sign/access-token", authn.TokenExchangeRequest{Namespace: "stacks-11", Audiences: []string{"grafana"}, SubjectToken: missingExpiry}, i); w.Code != 400 {
		t.Fatalf("missing expiry status %d", w.Code)
	}
}

func TestServiceExchangeHasOnlyScopedDelegatedPermissions(t *testing.T) {
	i := testIssuer(t)
	w := subjectRequest(t, "/sign/access-token", authn.TokenExchangeRequest{Namespace: "stacks-11", Audiences: []string{"error-tracking.grafana.app"}}, i)
	token := tokenFrom(t, w)
	claims, err := authn.NewAccessTokenVerifier(authn.VerifierConfig{AllowedAudiences: jwt.Audience{"error-tracking.grafana.app"}}, keyRetriever{i.key}).Verify(t.Context(), token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Rest.ServiceIdentity != "error-tracking-api" || claims.Rest.Actor != nil || len(claims.Rest.DelegatedPermissions) != 2 {
		t.Fatalf("unexpected service claims: %+v", claims.Rest)
	}
	for _, p := range claims.Rest.Permissions {
		if strings.Contains(p, "*") {
			t.Fatalf("wildcard permission: %q", p)
		}
	}
}

func TestSigningKeyPersistsAndCorruptionFails(t *testing.T) {
	path := filepath.Join(t.TempDir(), "key.json")
	a, err := loadKey(path)
	if err != nil {
		t.Fatal(err)
	}
	b, err := loadKey(path)
	if err != nil {
		t.Fatal(err)
	}
	aa, _ := json.Marshal(a)
	bb, _ := json.Marshal(b)
	if a.KeyID != b.KeyID || string(aa) != string(bb) {
		t.Fatal("reloaded key differs")
	}
	if err := os.WriteFile(path, []byte("not-json"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadKey(path); err == nil {
		t.Fatal("corrupt key was silently replaced")
	}
}
