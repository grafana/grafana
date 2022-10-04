package interceptors

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// Authenticator can authenticate GRPC requests.
type Authenticator struct {
	logger      log.Logger
	APIKey      apikey.Service
	UserService user.Service
}

func NewAuthenticator(apiKey apikey.Service, userService user.Service) *Authenticator {
	return &Authenticator{
		logger:      log.New("grpc-server-authenticator"),
		APIKey:      apiKey,
		UserService: userService,
	}
}

// Authenticate checks that a token exists and is valid, and then removes the token from the
// authorization header in the context.
func (a *Authenticator) Authenticate(ctx context.Context) (context.Context, error) {
	return a.tokenAuth(ctx)
}

const tokenPrefix = "Bearer "

func (a *Authenticator) tokenAuth(ctx context.Context) (context.Context, error) {
	auth, err := extractAuthorization(ctx)
	if err != nil {
		return ctx, err
	}

	if !strings.HasPrefix(auth, tokenPrefix) {
		return ctx, status.Error(codes.Unauthenticated, `missing "Bearer " prefix in "authorization" value`)
	}

	token := strings.TrimPrefix(auth, tokenPrefix)
	if token == "" {
		return ctx, status.Error(codes.Unauthenticated, "token required")
	}

	newCtx := purgeHeader(ctx, "authorization")

	_, err = a.getSignedInUser(ctx, token)
	if err != nil {
		logger.Warn("request with invalid token", "error", err, "token", token)
		return ctx, status.Error(codes.Unauthenticated, "invalid token")
	}

	return newCtx, nil
}

func (a *Authenticator) getSignedInUser(ctx context.Context, token string) (*user.SignedInUser, error) {
	decoded, err := apikeygenprefix.Decode(token)
	if err != nil {
		return nil, err
	}

	hash, err := decoded.Hash()
	if err != nil {
		return nil, err
	}

	apikey, err := a.APIKey.GetAPIKeyByHash(ctx, hash)
	if err != nil {
		return nil, err
	}

	if apikey == nil || apikey.ServiceAccountId == nil {
		return nil, status.Error(codes.Unauthenticated, "api key does not have a service account")
	}

	querySignedInUser := user.GetSignedInUserQuery{UserID: *apikey.ServiceAccountId, OrgID: apikey.OrgId}
	signedInUser, err := a.UserService.GetSignedInUserWithCacheCtx(ctx, &querySignedInUser)
	if err != nil {
		return nil, err
	}

	if !signedInUser.HasRole(org.RoleAdmin) {
		return nil, fmt.Errorf("api key does not have admin role")
	}

	// disabled service accounts are not allowed to access the API
	if signedInUser.IsDisabled {
		return nil, fmt.Errorf("service account is disabled")
	}

	return signedInUser, nil
}

func extractAuthorization(ctx context.Context) (string, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", status.Error(codes.Unauthenticated, "no headers in request")
	}

	authHeaders, ok := md["authorization"]
	if !ok {
		return "", status.Error(codes.Unauthenticated, `no "authorization" header in request`)
	}

	if len(authHeaders) != 1 {
		return "", status.Error(codes.Unauthenticated, `malformed "authorization" header: one value required`)
	}

	return authHeaders[0], nil
}

func purgeHeader(ctx context.Context, header string) context.Context {
	md, _ := metadata.FromIncomingContext(ctx)
	mdCopy := md.Copy()
	mdCopy[header] = nil
	return metadata.NewIncomingContext(ctx, mdCopy)
}
