package grpcserver

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// Authenticator can authenticate GRPC requests.
type Authenticator struct {
	logger   log.Logger
	APIKey   apikey.Service
	SQLStore sqlstore.Store
}

func NewAuthenticator(apiKey apikey.Service, sqlStore sqlstore.Store) *Authenticator {
	return &Authenticator{
		logger:   log.New("grpc-server-authenticator"),
		APIKey:   apiKey,
		SQLStore: sqlStore,
	}
}

// Authenticate checks that a token exists and is valid. It stores the user
// metadata in the returned context and removes the token from the context.
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

	err = a.validateToken(ctx, token)
	if err != nil {
		logger.Warn("request with invalid token", "error", err, "token", token)
		return ctx, status.Error(codes.Unauthenticated, "invalid token")
	}
	return newCtx, nil
}

func (a *Authenticator) validateToken(ctx context.Context, keyString string) error {
	decoded, err := apikeygenprefix.Decode(keyString)
	if err != nil {
		return err
	}

	hash, err := decoded.Hash()
	if err != nil {
		return err
	}

	apikey, err := a.APIKey.GetAPIKeyByHash(ctx, hash)
	if err != nil {
		return err
	}

	if apikey == nil || apikey.ServiceAccountId == nil {
		return status.Error(codes.Unauthenticated, "api key does not have a service account")
	}

	querySignedInUser := models.GetSignedInUserQuery{UserId: *apikey.ServiceAccountId, OrgId: apikey.OrgId}
	if err := a.SQLStore.GetSignedInUserWithCacheCtx(ctx, &querySignedInUser); err != nil {
		return err
	}

	if !querySignedInUser.Result.HasRole(models.ROLE_ADMIN) {
		return fmt.Errorf("api key does not have admin role")
	}

	// disabled service accounts are not allowed to access the API
	if querySignedInUser.Result.IsDisabled {
		return fmt.Errorf("service account is disabled")
	}

	return nil
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
