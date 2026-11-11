package authn

import (
	"context"
	"errors"
	"net/http"
	"strings"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// datasourceAudience is the audience datasource API servers accept for every
// <type>.datasource.grafana.app group. A token signed for a request to one of
// those groups names it rather than the group itself.
const datasourceAudience = "*.datasource.grafana.app"

// VerifyAccessTokenForRequest verifies token with verifier, which checks the
// configured audiences. If only the audience check fails, it verifies token
// again with the API group req is addressed to (see utils.APIGroupFromRequest)
// as the allowed audience, or datasourceAudience for a datasource group. keys
// must be the keys verifier uses; without them, or for a request to no API
// group, only the configured audiences are accepted.
func VerifyAccessTokenForRequest(ctx context.Context, token string, req *http.Request, verifier authnlib.Verifier[authnlib.AccessTokenClaims], keys authnlib.KeyRetriever) (*authnlib.Claims[authnlib.AccessTokenClaims], error) {
	claims, err := verifier.Verify(ctx, token)
	if !errors.Is(err, authnlib.ErrInvalidAudience) || keys == nil {
		return claims, err
	}
	group := utils.APIGroupFromRequest(req)
	if group == "" {
		return nil, err
	}
	audiences := []string{group}
	if isDatasourceGroup(group) {
		audiences = append(audiences, datasourceAudience)
	}
	return authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: audiences}, keys).Verify(ctx, token)
}

// isDatasourceGroup reports whether group is <type>.datasource.grafana.app for
// a single-segment type. The shared datasource.grafana.app group is not one.
func isDatasourceGroup(group string) bool {
	datasourceType, ok := strings.CutSuffix(group, ".datasource.grafana.app")
	return ok && datasourceType != "" && !strings.Contains(datasourceType, ".")
}
