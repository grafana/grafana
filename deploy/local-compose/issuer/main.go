package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
)

const (
	bearer      = "ThisIsMySecretToken"
	issuerName  = "auth"
	keyID       = "local-es256"
	defaultTTL  = 12 * time.Hour
	servicePerm = "error-tracking.grafana.app/events:"
)

var allowedAudiences = map[string]bool{
	"error-tracking.grafana.app": true, "grafana": true,
	"cloudAppPlatformDiscovery": true, "folder.grafana.app": true, "resourceStore": true,
}

type tokenIssuer struct {
	key *jose.JSONWebKey
}

type verifiedSubject struct {
	id      authn.IDTokenClaims
	subject string
}

type response struct {
	Data map[string]string `json:"data"`
}

type remoteIDTokenRequest struct {
	Namespace string              `json:"namespace"`
	Claims    jwt.Claims          `json:"claims"`
	Extra     authn.IDTokenClaims `json:"extra"`
}

func main() {
	key, err := loadKey("/app/data/keys/es256.key")
	if err != nil {
		log.Fatal(err)
	}
	i := &tokenIssuer{key: key}
	http.HandleFunc("/jwks", i.jwks)
	http.HandleFunc("/sign/id-token", i.idToken)
	http.HandleFunc("/sign/access-token", i.accessToken)
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func (i *tokenIssuer) authorized(r *http.Request) bool {
	return r.Method == http.MethodPost && r.Header.Get("Authorization") == "Bearer "+bearer
}

func (i *tokenIssuer) idToken(w http.ResponseWriter, r *http.Request) {
	if !i.authorized(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "invalid token request", http.StatusBadRequest)
		return
	}
	var req remoteIDTokenRequest
	if json.Unmarshal(body, &req) != nil {
		http.Error(w, "invalid token request", http.StatusBadRequest)
		return
	}
	namespace, claims := req.Namespace, req.Claims
	subject := authn.TokenExchangeSubject{Sub: claims.Subject, Identifier: req.Extra.Identifier, Type: string(req.Extra.Type), Namespace: namespace, AuthenticatedBy: req.Extra.AuthenticatedBy, Email: req.Extra.Email, EmailVerified: req.Extra.EmailVerified, Username: req.Extra.Username, DisplayName: req.Extra.DisplayName, Role: req.Extra.Role, Groups: req.Extra.Groups}
	if claims.Expiry == nil || len(claims.Audience) == 0 {
		http.Error(w, "invalid token request", http.StatusBadRequest)
		return
	}
	if !validRequest(namespace, claims.Audience) || !validSubject(namespace, &subject) {
		http.Error(w, "invalid token request", http.StatusBadRequest)
		return
	}
	claims.Issuer = issuerName
	id := authn.IDTokenClaims{Identifier: subject.Identifier, Type: identityType(subject.Type), Namespace: namespace, AuthenticatedBy: subject.AuthenticatedBy, Email: subject.Email, EmailVerified: subject.EmailVerified, Username: subject.Username, DisplayName: subject.DisplayName, Role: subject.Role, Groups: subject.Groups}
	token, err := i.sign(authn.TokenTypeID, claims, id)
	if err != nil {
		http.Error(w, "signing failed", http.StatusInternalServerError)
		return
	}
	writeToken(w, token)
}

func (i *tokenIssuer) accessToken(w http.ResponseWriter, r *http.Request) {
	if !i.authorized(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var req authn.TokenExchangeRequest
	if json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req) != nil || (req.Subject == nil) == (req.SubjectToken == "") && !(req.Subject == nil && req.SubjectToken == "" && serviceExchange(req)) {
		http.Error(w, "invalid token request", http.StatusBadRequest)
		return
	}
	if !validRequest(req.Namespace, req.Audiences) {
		log.Printf("access-token rejected: namespace=%q audiences=%q", req.Namespace, req.Audiences)
		http.Error(w, "invalid token request", http.StatusBadRequest)
		return
	}
	var id authn.IDTokenClaims
	subject := ""
	service := serviceExchange(req)
	if req.SubjectToken != "" && !service {
		verified, err := i.verifySubject(req.SubjectToken, req.Namespace)
		if err != nil {
			log.Printf("access-token subject rejected: namespace=%q audiences=%q reason=%v", req.Namespace, req.Audiences, err)
			http.Error(w, "invalid subject token", http.StatusBadRequest)
			return
		}
		id, subject = verified.id, verified.subject
	} else if !service {
		if !validSubject(req.Namespace, req.Subject) {
			http.Error(w, "invalid token request", http.StatusBadRequest)
			return
		}
		id = authn.IDTokenClaims{Identifier: req.Subject.Identifier, Type: identityType(req.Subject.Type), Namespace: req.Subject.Namespace, AuthenticatedBy: req.Subject.AuthenticatedBy, Email: req.Subject.Email, EmailVerified: req.Subject.EmailVerified, Username: req.Subject.Username, DisplayName: req.Subject.DisplayName, Role: req.Subject.Role, Groups: req.Subject.Groups}
	}
	permissions := []string{servicePerm + "create", servicePerm + "list"}
	access := authn.AccessTokenClaims{Namespace: req.Namespace, Permissions: permissions, DelegatedPermissions: delegatedPermissions(req.RestrictedDelegatedPermissions)}
	if service {
		access.ServiceIdentity = "error-tracking-api"
	} else {
		if subject == "" {
			subject = subjectValue(&authn.TokenExchangeSubject{Identifier: id.Identifier, Type: string(id.Type)})
		}
		access.Actor = &authn.ActorClaims{Subject: subject, IDTokenClaims: id}
	}
	if !service {
		if subject == "" {
			subject = subjectValue(&authn.TokenExchangeSubject{Identifier: id.Identifier, Type: string(id.Type)})
		}
	}
	claims := jwt.Claims{Issuer: issuerName, Subject: subject, Audience: jwt.Audience(req.Audiences), IssuedAt: jwt.NewNumericDate(time.Now()), Expiry: jwt.NewNumericDate(nowPlus(req.ExpiresIn))}
	token, err := i.sign(authn.TokenTypeAccess, claims, access)
	if err != nil {
		http.Error(w, "signing failed", http.StatusInternalServerError)
		return
	}
	writeToken(w, token)
}

func (i *tokenIssuer) verifySubject(raw, namespace string) (verifiedSubject, error) {
	parsed, err := jwt.ParseSigned(raw, []jose.SignatureAlgorithm{jose.ES256})
	if err != nil {
		return verifiedSubject{}, err
	}
	if typ, err := authn.GetType(parsed); err != nil || typ != authn.TokenTypeID {
		return verifiedSubject{}, errors.New("invalid subject token type")
	}
	var claims authn.Claims[authn.IDTokenClaims]
	if err := parsed.Claims(i.key.Key.(*ecdsa.PrivateKey).Public(), &claims.Claims, &claims.Rest); err != nil {
		return verifiedSubject{}, err
	}
	if claims.Issuer != issuerName || claims.Expiry == nil || len(claims.Audience) == 0 || claims.Rest.Namespace != namespace || claims.Subject == "" || !strings.HasPrefix(claims.Subject, string(claims.Rest.Type)+":") {
		return verifiedSubject{}, errors.New("invalid subject claims")
	}
	for _, audience := range claims.Audience {
		if !allowedAudience(audience) {
			return verifiedSubject{}, errors.New("invalid subject audience")
		}
	}
	if err := claims.Validate(jwt.Expected{Issuer: issuerName, Time: time.Now()}); err != nil {
		return verifiedSubject{}, err
	}
	return verifiedSubject{id: claims.Rest, subject: claims.Subject}, nil
}

func (i *tokenIssuer) sign(typ string, standard jwt.Claims, rest any) (string, error) {
	// Authlib distinguishes ID tokens (typ=jwt) from access tokens (typ=at+jwt).
	// Build the signer per request so the wire type cannot drift between endpoints.
	if typ == "" {
		typ = authn.TokenTypeID
	}
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: i.key.Key}, (&jose.SignerOptions{}).WithType(jose.ContentType(typ)).WithHeader("kid", keyID))
	if err != nil {
		return "", err
	}
	return jwt.Signed(signer).Claims(standard).Claims(rest).Serialize()
}
func (i *tokenIssuer) jwks(w http.ResponseWriter, _ *http.Request) {
	private := i.key.Key.(*ecdsa.PrivateKey)
	b, err := json.Marshal(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &private.PublicKey, Algorithm: string(jose.ES256), KeyID: keyID, Use: "sig"}}})
	if err != nil {
		http.Error(w, "jwks unavailable", 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(b)
}
func writeToken(w http.ResponseWriter, token string) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response{Data: map[string]string{"token": token}})
}
func validRequest(namespace string, audiences []string) bool {
	if !validNamespace(namespace) || len(audiences) == 0 {
		return false
	}
	for _, a := range audiences {
		if !allowedAudience(a) {
			return false
		}
	}
	return true
}

func allowedAudience(audience string) bool {
	if allowedAudiences[audience] {
		return true
	}
	if !strings.HasPrefix(audience, "org:") {
		return false
	}
	value, err := strconv.ParseInt(strings.TrimPrefix(audience, "org:"), 10, 64)
	return err == nil && value > 0
}

func validNamespace(namespace string) bool {
	if namespace == "*" || namespace == "default" || namespace == "stacks-11" || namespace == "stacks-22" {
		return true
	}
	if strings.HasPrefix(namespace, "org:") {
		value, err := strconv.ParseInt(strings.TrimPrefix(namespace, "org:"), 10, 64)
		return err == nil && value > 0
	}
	return false
}

func serviceExchange(req authn.TokenExchangeRequest) bool {
	if len(req.Audiences) != 1 || req.Subject != nil || (req.SubjectToken != "" && req.SubjectToken != bearer) {
		return false
	}
	return req.Audiences[0] == "error-tracking.grafana.app" || req.Audiences[0] == "cloudAppPlatformDiscovery"
}

func delegatedPermissions(restricted []string) []string {
	allowed := []string{servicePerm + "create", servicePerm + "list"}
	if len(restricted) == 0 {
		return allowed
	}
	set := make(map[string]bool, len(restricted))
	for _, permission := range restricted {
		set[permission] = true
	}
	result := make([]string, 0, len(allowed))
	for _, permission := range allowed {
		if set[permission] {
			result = append(result, permission)
		}
	}
	return result
}
func validSubject(namespace string, s *authn.TokenExchangeSubject) bool {
	if s == nil || s.Namespace != namespace || s.Identifier == "" || (s.Type != "user" && s.Type != "service-account") {
		return false
	}
	return s.Sub == "" || strings.HasPrefix(s.Sub, s.Type+":")
}
func subjectValue(s *authn.TokenExchangeSubject) string {
	if s.Sub != "" {
		return s.Sub
	}
	return s.Type + ":" + s.Identifier
}
func nowPlus(seconds *int) time.Time {
	if seconds == nil || *seconds <= 0 || time.Duration(*seconds)*time.Second > defaultTTL {
		return time.Now().Add(defaultTTL)
	}
	return time.Now().Add(time.Duration(*seconds) * time.Second)
}
func identityType(s string) types.IdentityType { return types.IdentityType(s) }

func loadKey(path string) (*jose.JSONWebKey, error) {
	b, err := os.ReadFile(path)
	if err == nil {
		var key jose.JSONWebKey
		if err := json.Unmarshal(b, &key); err != nil || key.Key == nil {
			return nil, fmt.Errorf("invalid signing key: %w", err)
		}
		if _, ok := key.Key.(*ecdsa.PrivateKey); !ok {
			return nil, errors.New("invalid signing key type")
		}
		return &key, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}
	key := &jose.JSONWebKey{Key: private, Algorithm: string(jose.ES256), KeyID: keyID, Use: "sig"}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	b, err = json.Marshal(key)
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, b, 0600); err != nil {
		return nil, err
	}
	return key, nil
}
