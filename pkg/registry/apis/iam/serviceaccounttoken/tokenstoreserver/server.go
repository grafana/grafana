// Package tokenstoreserver serves the iam.grafana.app service account token store
// gRPC service on top of a satoken.Storage, i.e. the serviceaccount_token table.
package tokenstoreserver

import (
	"context"
	"errors"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authlibgrpcutils "github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"

	satokenpb "github.com/grafana/grafana/apps/iam/serviceaccounttoken/v0alpha1"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

// Server adapts satoken.Storage to the gRPC service. It owns no state of its own:
// every call is delegated to the store.
type Server struct {
	store satoken.Storage
}

var _ satokenpb.ServiceAccountTokenStoreServer = (*Server)(nil)

func NewServer(store satoken.Storage) *Server {
	return &Server{store: store}
}

func (s *Server) CreateToken(ctx context.Context, req *satokenpb.CreateTokenRequest) (*satokenpb.CreateTokenResponse, error) {
	token, err := s.store.Add(ctx, &satoken.AddTokenCommand{
		Namespace:          req.GetNamespace(),
		ServiceAccountName: req.GetServiceAccountName(),
		Name:               req.GetName(),
		Key:                req.GetKey(),
		SecondsToLive:      req.GetSecondsToLive(),
	})
	if err != nil {
		return nil, mapError(err, "creating token")
	}

	return &satokenpb.CreateTokenResponse{Token: toProto(token)}, nil
}

func (s *Server) GetToken(ctx context.Context, req *satokenpb.GetTokenRequest) (*satokenpb.GetTokenResponse, error) {
	token, err := s.store.GetByName(ctx, &satoken.GetByNameQuery{
		Namespace:          req.GetNamespace(),
		ServiceAccountName: req.GetServiceAccountName(),
		Name:               req.GetName(),
	})
	if err != nil {
		return nil, mapError(err, "getting token")
	}

	return &satokenpb.GetTokenResponse{Token: toProto(token)}, nil
}

func (s *Server) ListTokens(ctx context.Context, req *satokenpb.ListTokensRequest) (*satokenpb.ListTokensResponse, error) {
	res, err := s.store.ListByServiceAccount(ctx, req.GetNamespace(), req.GetServiceAccountName(), req.GetLimit(), req.GetContinueToken())
	if err != nil {
		return nil, mapError(err, "listing tokens")
	}

	items := make([]*satokenpb.Token, 0, len(res.Items))
	for _, item := range res.Items {
		items = append(items, toProto(item))
	}

	return &satokenpb.ListTokensResponse{Items: items, ContinueToken: res.Continue}, nil
}

func (s *Server) DeleteToken(ctx context.Context, req *satokenpb.DeleteTokenRequest) (*satokenpb.DeleteTokenResponse, error) {
	if err := s.store.Delete(ctx, req.GetNamespace(), req.GetServiceAccountName(), req.GetName()); err != nil {
		return nil, mapError(err, "deleting token")
	}

	return &satokenpb.DeleteTokenResponse{}, nil
}

func (s *Server) GetTokenByHash(ctx context.Context, req *satokenpb.GetTokenByHashRequest) (*satokenpb.GetTokenByHashResponse, error) {
	token, err := s.store.GetByHash(ctx, req.GetHash())
	if err != nil {
		return nil, mapError(err, "getting token by hash")
	}

	// The key column is unique across all namespaces, so scope the result to the
	// requested one. Report a mismatch as missing rather than forbidden so hashes
	// cannot be probed for existence.
	if token.Namespace != req.GetNamespace() {
		return nil, status.Error(codes.NotFound, satoken.ErrTokenNotFound.Error())
	}

	return &satokenpb.GetTokenByHashResponse{Token: toProto(token)}, nil
}

func (s *Server) UpdateTokenLastUsedDate(ctx context.Context, req *satokenpb.UpdateTokenLastUsedDateRequest) (*satokenpb.UpdateTokenLastUsedDateResponse, error) {
	if err := s.store.UpdateLastUsedDate(ctx, req.GetId()); err != nil {
		return nil, mapError(err, "updating token last used date")
	}

	return &satokenpb.UpdateTokenLastUsedDateResponse{}, nil
}

// NewInProcChannel serves store over an in-process channel.
//
// Authentication matches unified storage: the caller's access token carries the
// identity and namespace, and the authenticator turns it back into an AuthInfo on
// the server context. The unsafe authenticator does not verify the signature, which
// is acceptable only because both ends are the same process.
func NewInProcChannel(store satoken.Storage, tracer trace.Tracer) *inprocgrpc.Channel {
	channel := (&inprocgrpc.Channel{}).WithServerUnaryInterceptor(
		grpc_middleware.ChainUnaryServer(UnaryServerInterceptors(tracer)...),
	)
	satokenpb.RegisterServiceAccountTokenStoreServer(channel, NewServer(store))
	return channel
}

// UnaryServerInterceptors is the chain every registration of this service must use,
// in order: the authenticator turns the caller's access token into an AuthInfo, then
// the authz check reads it.
//
// The authenticator here does not verify token signatures, so a registration exposed
// off-process must substitute one that does.
func UnaryServerInterceptors(tracer trace.Tracer) []grpc.UnaryServerInterceptor {
	return []grpc.UnaryServerInterceptor{
		grpcAuth.UnaryServerInterceptor(authlibgrpcutils.NewUnsafeAuthenticator(tracer)),
		AuthorizeUnaryInterceptor,
	}
}

// AuthorizeUnaryInterceptor restricts every RPC to service-to-service callers acting
// within a namespace their token permits. The store holds hashed credentials and is
// never called on behalf of a user, so anything but an access policy is denied.
//
// Every request message carries a namespace, so this replaces per-RPC checks.
func AuthorizeUnaryInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok || authInfo == nil {
		return nil, status.Error(codes.Unauthenticated, "auth info not found")
	}

	if !types.IsIdentityType(authInfo.GetIdentityType(), types.TypeAccessPolicy) {
		return nil, status.Error(codes.PermissionDenied, "not an access policy")
	}

	namespaced, ok := req.(interface{ GetNamespace() string })
	if !ok {
		return nil, status.Error(codes.Internal, "request carries no namespace")
	}

	if !types.NamespaceMatches(authInfo.GetNamespace(), namespaced.GetNamespace()) {
		return nil, status.Error(codes.PermissionDenied, "invalid namespace")
	}

	return handler(ctx, req)
}

// mapError turns store sentinels into status codes the client maps back.
func mapError(err error, action string) error {
	switch {
	case errors.Is(err, satoken.ErrTokenDuplicate):
		return status.Error(codes.AlreadyExists, err.Error())
	case errors.Is(err, satoken.ErrTokenNotFound):
		return status.Error(codes.NotFound, err.Error())
	default:
		return status.Errorf(codes.Internal, "%s: %s", action, err)
	}
}

// toProto flattens the domain token. Nil optionals and the hashed key are omitted:
// 0 is the wire representation of "unset" and read paths never return the key.
func toProto(t *satoken.Token) *satokenpb.Token {
	token := &satokenpb.Token{
		Id:                 t.ID,
		Namespace:          t.Namespace,
		Name:               t.Name,
		ServiceAccountName: t.ServiceAccountName,
		Created:            t.Created.Unix(),
		Updated:            t.Updated.Unix(),
	}
	if t.LastUsedAt != nil {
		token.LastUsedAt = t.LastUsedAt.Unix()
	}
	if t.IsRevoked != nil {
		token.IsRevoked = *t.IsRevoked
	}
	if t.Expires != nil {
		token.Expires = *t.Expires
	}
	return token
}
