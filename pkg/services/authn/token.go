package authn

import (
	"context"
	"fmt"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

type TokenAuthenticator interface {
	AuthenticateToken(ctx context.Context, token string) (identity.Requester, error)
}

var _ TokenAuthenticator = (*GrafanaTokenAuthenticator)(nil)

type GrafanaTokenAuthenticator struct {
	verifier authnlib.Verifier[authnlib.AccessTokenClaims]
}

func NewGrafanaTokenAuthenticator(cfg *setting.Cfg) (*GrafanaTokenAuthenticator, error) {
	if cfg.ExtJWTAuth.JWKSUrl == "" {
		return nil, fmt.Errorf("missing cfg.ExtJWTAuth.JWKSUrl (NewGrafanaTokenAuthenticator)")
	}
	if len(cfg.ExtJWTAuth.Audiences) < 1 {
		return nil, fmt.Errorf("missing cfg.ExtJWTAuth.Audiences (NewGrafanaTokenAuthenticator)")
	}

	keys := authnlib.NewKeyRetriever(authnlib.KeyRetrieverConfig{SigningKeysURL: cfg.ExtJWTAuth.JWKSUrl})
	return &GrafanaTokenAuthenticator{
		verifier: authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{
			AllowedAudiences: cfg.ExtJWTAuth.Audiences,
		}, keys),
	}, nil
}

func (t *GrafanaTokenAuthenticator) AuthenticateToken(ctx context.Context, token string) (identity.Requester, error) {
	token = strings.TrimPrefix(token, "Bearer ")
	if token == "" {
		return nil, apierrors.NewUnauthorized("empty token")
	}
	if t.verifier == nil {
		return nil, apierrors.NewUnauthorized("token verifier is not configured")
	}
	claims, err := t.verifier.Verify(ctx, token)
	if err != nil || claims == nil {
		return nil, apierrors.NewUnauthorized("invalid access token")
	}
	subjectType, _, err := types.ParseTypeID(claims.Subject)
	if err != nil || subjectType != types.TypeAccessPolicy {
		return nil, apierrors.NewUnauthorized("invalid access token subject")
	}
	info := authnlib.NewAccessTokenAuthInfo(*claims)
	typ, id, err := types.ParseTypeID(info.GetSubject())
	if err != nil || typ != info.GetIdentityType() || info.GetIdentifier() == "" {
		return nil, apierrors.NewUnauthorized("invalid token identity")
	}
	ns, err := types.ParseNamespace(info.GetNamespace())
	if err != nil || (ns.OrgID < 1 && ns.Value != "*") {
		return nil, apierrors.NewUnauthorized("invalid token namespace")
	}
	orgID := ns.OrgID
	if ns.Value == "*" {
		orgID = GlobalOrgID
	}
	return &grafanaTokenRequester{
		Identity: Identity{
			ID:                id,
			UID:               info.GetIdentifier(),
			Type:              typ,
			Name:              info.GetName(),
			Login:             info.GetUsername(),
			Email:             info.GetEmail(),
			EmailVerified:     info.GetEmailVerified(),
			Groups:            info.GetGroups(),
			OrgID:             orgID,
			Namespace:         ns.Value,
			AuthID:            claims.Subject,
			AuthenticatedBy:   login.ExtendedJWTModule,
			AccessToken:       token,
			AccessTokenClaims: claims,
		},
		info: info,
	}, nil
}

type grafanaTokenRequester struct {
	Identity
	info *authnlib.AuthInfo
}

// OBO identities use delegated permissions instead of the service's permissions.
func (r *grafanaTokenRequester) GetTokenPermissions() []string {
	return r.info.GetTokenPermissions()
}

func (r *grafanaTokenRequester) GetExtra() map[string][]string {
	return r.info.GetExtra()
}
