package authn

import (
	"context"
	"errors"
	"net/http"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
)

// datasourceAudience is the audience datasource API servers accept for every
// <type>.datasource.grafana.app group. A token signed for a request to one of
// those groups names it rather than the group itself.
const datasourceAudience = "*.datasource.grafana.app"

// VerifyAccessTokenForRequest verifies token as authnlib.VerifyAccessTokenForRequest
// does: with the configured audiences, or else the API group req is addressed
// to. For a request to a datasource group, it also accepts datasourceAudience.
func VerifyAccessTokenForRequest(ctx context.Context, token string, req *http.Request, verifier authnlib.Verifier[authnlib.AccessTokenClaims], keys authnlib.KeyRetriever) (*authnlib.Claims[authnlib.AccessTokenClaims], error) {
	claims, err := authnlib.VerifyAccessTokenForRequest(ctx, token, req, verifier, keys)
	if !errors.Is(err, authnlib.ErrInvalidAudience) || keys == nil || !isDatasourceGroup(authnlib.APIGroupFromRequest(req)) {
		return claims, err
	}
	return authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{datasourceAudience}}, keys).Verify(ctx, token)
}

// isDatasourceGroup reports whether group is <type>.datasource.grafana.app for
// a single-segment type. The shared datasource.grafana.app group is not one.
func isDatasourceGroup(group string) bool {
	datasourceType, ok := strings.CutSuffix(group, ".datasource.grafana.app")
	return ok && datasourceType != "" && !strings.Contains(datasourceType, ".")
}
