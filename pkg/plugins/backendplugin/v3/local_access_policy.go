package v3

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/plugin"
)

// LocalAccessPolicy is what a plugin started by this Grafana process may sign
// with SignLocalAccessToken. It stands in for the access policy behind a cloud
// access policy token, for when no token exchange is configured.
type LocalAccessPolicy struct {
	// PluginID identifies the plugin: its tokens have access-policy:<PluginID>
	// as the subject.
	PluginID string
	// Audiences are the audiences the plugin may request.
	Audiences []string
	// Permissions are granted to the plugin's own tokens.
	Permissions []string
	// DelegatedPermissions are delegated to its tokens on behalf of a caller,
	// where they only narrow what the caller may do.
	DelegatedPermissions []string
	// AllowSubjectSigning comes from Grafana configuration, never the plugin manifest.
	AllowSubjectSigning bool
	// MaxSubjectTokenLifetime limits asserted-subject requests. Zero uses the default lifetime.
	MaxSubjectTokenLifetime time.Duration
}

// DefaultLocalSubjectTokenLifetime applies when a subject request omits ExpiresIn.
const DefaultLocalSubjectTokenLifetime = localTokenTTL

// ErrLocalAccessDenied is returned by SignLocalAccessToken for a request that
// the policy does not allow.
var ErrLocalAccessDenied = errors.New("local plugin token exchange: access denied")

// LocalAccessPolicyTokenPrefix starts every local access policy token, so the
// API key client can leave them alone.
const LocalAccessPolicyTokenPrefix = "g_local_plugin_"

// localAccessPolicyHolder is what a local access policy token was issued to.
type localAccessPolicyHolder struct {
	pluginID string
	manifest *app.ManifestData
}

var localAccessPolicyTokens = struct {
	sync.Mutex
	byToken map[string]localAccessPolicyHolder
}{byToken: map[string]localAccessPolicyHolder{}}

// IssueLocalAccessPolicyToken returns a new secret that authenticates pluginID
// to the local token exchange: the local stand-in for a cloud access policy
// token. It is random and held only in memory. Grafana issues one each time it
// starts the plugin's process, passes it only to that process, and revokes it
// when the process stops or is replaced (see RevokeLocalAccessPolicyToken).
//
// manifest is the app manifest of that process's plugin. The exchange builds
// the token's policy from it, not from other copies of the plugin on disk.
func IssueLocalAccessPolicyToken(pluginID string, manifest *app.ManifestData) (string, error) {
	if pluginID == "" {
		return "", errors.New("local plugin token exchange: a plugin ID is required")
	}
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return "", fmt.Errorf("local plugin token exchange: %w", err)
	}
	token := LocalAccessPolicyTokenPrefix + base64.RawURLEncoding.EncodeToString(secret)

	localAccessPolicyTokens.Lock()
	defer localAccessPolicyTokens.Unlock()
	localAccessPolicyTokens.byToken[token] = localAccessPolicyHolder{pluginID: pluginID, manifest: manifest}
	return token, nil
}

// RevokeLocalAccessPolicyToken revokes token, issued by
// IssueLocalAccessPolicyToken, for when the process it was issued to stops.
func RevokeLocalAccessPolicyToken(token string) {
	localAccessPolicyTokens.Lock()
	defer localAccessPolicyTokens.Unlock()
	delete(localAccessPolicyTokens.byToken, token)
}

// LocalAccessPolicyTokenFromEnv returns the access policy token in a plugin
// process environment, if Grafana set one.
func LocalAccessPolicyTokenFromEnv(env []string) string {
	for _, v := range env {
		if token, ok := strings.CutPrefix(v, plugin.EnvVarAPIAccessCAPToken+"="); ok {
			return token
		}
	}
	return ""
}

// LookupLocalAccessPolicyToken returns the plugin and app manifest token was
// issued with by IssueLocalAccessPolicyToken, if it has not since been revoked.
func LookupLocalAccessPolicyToken(token string) (pluginID string, manifest *app.ManifestData, ok bool) {
	localAccessPolicyTokens.Lock()
	defer localAccessPolicyTokens.Unlock()
	holder, ok := localAccessPolicyTokens.byToken[token]
	return holder.pluginID, holder.manifest, ok
}

// SignLocalAccessToken signs an access token for the plugin of policy, as a
// token exchange does for an access policy. Grafana's API trusts these tokens
// when it trusts LocalKeyRetriever.
//
// Without a subject or subject token, the token acts as the plugin. A subject
// token must be a local access token issued to that plugin, limiting this path
// to callers that called it. AllowSubjectSigning authorizes the plugin to assert
// an identity directly. Both OBO forms use the policy's DelegatedPermissions.
func SignLocalAccessToken(ctx context.Context, policy LocalAccessPolicy, req authnlib.TokenExchangeRequest) (string, error) {
	e, err := sharedLocalExchanger()
	if err != nil {
		return "", err
	}
	return e.signForPolicy(ctx, policy, req)
}

func (e *localExchanger) signForPolicy(ctx context.Context, policy LocalAccessPolicy, req authnlib.TokenExchangeRequest) (string, error) {
	if policy.PluginID == "" {
		return "", errors.New("local plugin token exchange: a plugin ID is required")
	}
	if err := validateExchangeRequest(req); err != nil {
		return "", err
	}
	if req.Subject != nil && !policy.AllowSubjectSigning {
		return "", fmt.Errorf("%w: signing for an asserted subject is not supported", ErrLocalAccessDenied)
	}
	if req.Subject != nil && req.SubjectToken != "" {
		return "", errors.New("local plugin token exchange: subject and subjectToken are mutually exclusive")
	}
	for _, audience := range req.Audiences {
		if !slices.Contains(policy.Audiences, audience) {
			return "", fmt.Errorf("%w: audience %q is not allowed", ErrLocalAccessDenied, audience)
		}
	}
	claims := authnlib.AccessTokenClaims{Namespace: req.Namespace}
	lifetime := localTokenTTL
	if req.Subject == nil && req.SubjectToken == "" {
		claims.Permissions = policy.Permissions
	} else {
		// Like a token exchange, the restriction narrows only what is delegated.
		permissions := policy.DelegatedPermissions
		if len(req.RestrictedDelegatedPermissions) > 0 {
			permissions = slices.DeleteFunc(slices.Clone(permissions), func(p string) bool {
				return !slices.Contains(req.RestrictedDelegatedPermissions, p)
			})
		}
		// Empty delegated permissions remove the caller's RBAC permissions, but
		// the identity would still carry the caller's org role, which some APIs
		// check instead. Delegating nothing must not produce a usable token.
		if len(permissions) == 0 {
			return "", fmt.Errorf("%w: no permissions to delegate", ErrLocalAccessDenied)
		}
		claims.DelegatedPermissions = permissions
	}
	if req.Subject != nil {
		actor, err := actorFromSubject(req.Subject, req.Namespace)
		if err != nil {
			return "", err
		}
		claims.Actor = actor
		lifetime, err = subjectTokenLifetime(policy.MaxSubjectTokenLifetime, req.ExpiresIn)
		if err != nil {
			return "", err
		}
	} else if req.SubjectToken != "" {
		verifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{policy.PluginID}}, e.keys)
		subject, err := verifier.Verify(ctx, req.SubjectToken)
		if err != nil {
			return "", fmt.Errorf("%w: invalid subject token: %w", ErrLocalAccessDenied, err)
		}
		if !types.NamespaceMatches(subject.Rest.Namespace, req.Namespace) {
			return "", fmt.Errorf("%w: namespace %q does not match the subject token", ErrLocalAccessDenied, req.Namespace)
		}
		claims.Actor = &authnlib.ActorClaims{
			Subject:         subject.Subject,
			ServiceIdentity: subject.Rest.ServiceIdentity,
			Actor:           subject.Rest.Actor,
		}
	}
	return e.sign(types.NewTypeID(types.TypeAccessPolicy, policy.PluginID), req.Audiences, claims, lifetime)
}

func actorFromSubject(subject *authnlib.TokenExchangeSubject, namespace string) (*authnlib.ActorClaims, error) {
	deny := func(reason string) (*authnlib.ActorClaims, error) {
		return nil, fmt.Errorf("%w: %s", ErrLocalAccessDenied, reason)
	}
	ns, err := types.ParseNamespace(namespace)
	if err != nil || ns.OrgID < 1 || types.OrgNamespaceFormatter(ns.OrgID) != namespace || subject.Namespace != namespace {
		return deny("subject and request must name the same concrete organization namespace")
	}
	typ, id, err := types.ParseTypeID(subject.Sub)
	if err != nil || !types.IsIdentityType(typ, types.TypeUser, types.TypeServiceAccount) || string(typ) != subject.Type {
		return deny("subject must identify a user or service account with a matching type")
	}
	numericID, err := strconv.ParseInt(id, 10, 64)
	if err != nil || numericID < 1 || strconv.FormatInt(numericID, 10) != id || strings.TrimSpace(subject.Identifier) == "" {
		return deny("subject requires a positive numeric ID and a UID identifier")
	}
	// Grafana resolves the account's current profile, role and permissions when
	// the token is used; caller-supplied copies must not become authority.
	return &authnlib.ActorClaims{Subject: subject.Sub, IDTokenClaims: authnlib.IDTokenClaims{
		Identifier: subject.Identifier,
		Type:       typ,
		Namespace:  namespace,
	}}, nil
}

func subjectTokenLifetime(maximum time.Duration, requested *int) (time.Duration, error) {
	if maximum == 0 {
		maximum = DefaultLocalSubjectTokenLifetime
	}
	if requested == nil {
		return DefaultLocalSubjectTokenLifetime, nil
	}
	// Compare seconds before conversion so an oversized integer cannot overflow.
	if *requested <= 0 || int64(*requested) > int64(maximum/time.Second) {
		return 0, fmt.Errorf("%w: expiresIn must be positive and no greater than %d seconds", ErrLocalAccessDenied, maximum/time.Second)
	}
	return time.Duration(*requested) * time.Second, nil
}

func (e *localExchanger) sign(subject string, audiences []string, claims authnlib.AccessTokenClaims, lifetime time.Duration) (string, error) {
	now := time.Now()
	token, err := jwt.Signed(e.signer).Claims(jwt.Claims{
		Subject:   subject,
		Audience:  jwt.Audience(audiences),
		IssuedAt:  jwt.NewNumericDate(now),
		NotBefore: jwt.NewNumericDate(now),
		Expiry:    jwt.NewNumericDate(now.Add(lifetime)),
	}).Claims(claims).Serialize()
	if err != nil {
		return "", fmt.Errorf("local plugin token exchange: %w", err)
	}
	return token, nil
}
