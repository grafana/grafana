package authn

import (
	"context"
	"errors"
	"net/http"
	"strings"

	authnlib "github.com/grafana/authlib/authn"
)

// VerifyAccessTokenForRequest accepts the configured audiences or the API group
// addressed by req. Both verifiers must trust the same signing keys.
func VerifyAccessTokenForRequest(ctx context.Context, token string, req *http.Request, verifier authnlib.Verifier[authnlib.AccessTokenClaims], keys authnlib.KeyRetriever) (*authnlib.Claims[authnlib.AccessTokenClaims], error) {
	claims, err := verifier.Verify(ctx, token)
	if !errors.Is(err, authnlib.ErrInvalidAudience) || keys == nil {
		return claims, err
	}
	group := apiGroupFromRequest(req)
	if group == "" {
		return nil, err
	}
	return authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{group}}, keys).Verify(ctx, token)
}

func apiGroupFromRequest(req *http.Request) string {
	if req == nil || req.URL == nil {
		return ""
	}
	rest, ok := strings.CutPrefix(req.URL.Path, "/apis/")
	if !ok {
		return ""
	}
	// Path normalization downstream must not change the group being authorized.
	if strings.Contains(strings.ToLower(req.URL.EscapedPath()), "%2f") {
		return ""
	}
	for segment := range strings.SplitSeq(strings.TrimSuffix(rest, "/"), "/") {
		if segment == "" || segment == "." || segment == ".." {
			return ""
		}
	}
	group, _, _ := strings.Cut(rest, "/")
	// Plugin IDs, the audience of locally issued outbound tokens, have no dot.
	if !strings.Contains(group, ".") {
		return ""
	}
	return group
}
