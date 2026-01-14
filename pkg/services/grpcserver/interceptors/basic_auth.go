package interceptors

import (
	"context"
	"crypto/subtle"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

// basicAuthenticator implements basic authentication for gRPC requests.
type basicAuthenticator struct {
	username string
	password string
	logger   log.Logger
}

// NewBasicAuthenticator creates a new basic auth authenticator with the provided credentials.
func NewBasicAuthenticator(username, password string) Authenticator {
	return &basicAuthenticator{
		username: username,
		password: password,
		logger:   log.New("grpc-basic-authenticator"),
	}
}

const basicPrefix = "Basic "

// Authenticate validates basic auth credentials from the gRPC request metadata.
func (a *basicAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	auth, err := extractAuthorization(ctx)
	if err != nil {
		return ctx, err
	}

	if !strings.HasPrefix(auth, basicPrefix) {
		return ctx, status.Error(codes.Unauthenticated, `missing "Basic " prefix in "authorization" value`)
	}

	// Decode credentials (DecodeBasicAuthHeader expects the full "Basic <credentials>" string)
	username, password, err := util.DecodeBasicAuthHeader(auth)
	if err != nil {
		a.logger.Warn("failed to decode basic auth header", "error", err)
		return ctx, status.Error(codes.Unauthenticated, "invalid basic auth credentials")
	}

	// Use constant-time comparison to prevent timing attacks
	validUsername := subtle.ConstantTimeCompare([]byte(username), []byte(a.username)) == 1
	validPassword := subtle.ConstantTimeCompare([]byte(password), []byte(a.password)) == 1

	if !validUsername || !validPassword {
		a.logger.Warn("invalid credentials provided", "username", username)
		return ctx, status.Error(codes.Unauthenticated, "invalid username or password")
	}

	// Remove authorization header from context
	newCtx := purgeHeader(ctx, "authorization")

	a.logger.Debug("successfully authenticated request", "username", username)
	return newCtx, nil
}
