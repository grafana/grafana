// Package grpcstore implements satoken.Storage on top of the iam.grafana.app
// service account token store gRPC service.
//
// Every satoken.Storage method hits the wire. Authentication matches unified
// storage: a per-call access token carries the namespace, so the server reads it
// from the token rather than from anything the caller passes alongside it.
//
// GetByHash and UpdateLastUsedDate take no namespace parameter, so ctx must carry a
// namespaced identity (see identity.WithServiceIdentityForSingleNamespace).
package grpcstore

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/fullstorydev/grpchan"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	satokenpb "github.com/grafana/grafana/apps/iam/serviceaccounttoken/v0alpha1"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

type store struct {
	cc             grpc.ClientConnInterface
	tokenExchanger authnlib.TokenExchanger
	tracer         trace.Tracer
}

var _ satoken.Storage = (*store)(nil)

// New accepts a grpc.ClientConnInterface so the same store serves both an
// in-process channel and a dialled connection.
func New(cc grpc.ClientConnInterface, tokenExchanger authnlib.TokenExchanger, tracer trace.Tracer) satoken.Storage {
	return &store{
		cc:             cc,
		tokenExchanger: tokenExchanger,
		tracer:         tracer,
	}
}

// clientFor returns a client whose calls carry an access token signed for namespace.
// The interceptor is built per call because the namespace is part of the token.
func (s *store) clientFor(namespace string) satokenpb.ServiceAccountTokenStoreClient {
	interceptor := authnlib.NewGrpcClientInterceptor(
		s.tokenExchanger,
		authnlib.WithClientInterceptorTracer(s.tracer),
		authnlib.WithClientInterceptorNamespace(namespace),
		authnlib.WithClientInterceptorAudience([]string{iamv0alpha1.APIGroup}),
	)
	cc := grpchan.InterceptClientConn(s.cc, interceptor.UnaryClientInterceptor, interceptor.StreamClientInterceptor)
	return satokenpb.NewServiceAccountTokenStoreClient(cc)
}

func (s *store) Add(ctx context.Context, cmd *satoken.AddTokenCommand) (*satoken.Token, error) {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenGrpcStore.Add")
	defer span.End()

	resp, err := s.clientFor(cmd.Namespace).CreateToken(ctx, &satokenpb.CreateTokenRequest{
		Namespace:          cmd.Namespace,
		ServiceAccountName: cmd.ServiceAccountName,
		Name:               cmd.Name,
		Key:                cmd.Key,
		SecondsToLive:      cmd.SecondsToLive,
	})
	if err != nil {
		return nil, mapError(err, "creating token")
	}

	return fromProto(resp.GetToken()), nil
}

func (s *store) GetByName(ctx context.Context, query *satoken.GetByNameQuery) (*satoken.Token, error) {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenGrpcStore.GetByName")
	defer span.End()

	resp, err := s.clientFor(query.Namespace).GetToken(ctx, &satokenpb.GetTokenRequest{
		Namespace:          query.Namespace,
		ServiceAccountName: query.ServiceAccountName,
		Name:               query.Name,
	})
	if err != nil {
		return nil, mapError(err, "getting token")
	}

	return fromProto(resp.GetToken()), nil
}

func (s *store) ListByServiceAccount(ctx context.Context, namespace, serviceAccountName string, limit, continueToken int64) (*satoken.ListResult, error) {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenGrpcStore.ListByServiceAccount")
	defer span.End()

	resp, err := s.clientFor(namespace).ListTokens(ctx, &satokenpb.ListTokensRequest{
		Namespace:          namespace,
		ServiceAccountName: serviceAccountName,
		Limit:              limit,
		ContinueToken:      continueToken,
	})
	if err != nil {
		return nil, mapError(err, "listing tokens")
	}

	items := make([]*satoken.Token, 0, len(resp.GetItems()))
	for _, item := range resp.GetItems() {
		items = append(items, fromProto(item))
	}

	return &satoken.ListResult{Items: items, Continue: resp.GetContinueToken()}, nil
}

// GetByHash resolves a token by its hashed key, scoped to the namespace on the
// caller's identity so a hash cannot be resolved across namespaces.
func (s *store) GetByHash(ctx context.Context, hash string) (*satoken.Token, error) {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenGrpcStore.GetByHash")
	defer span.End()

	namespace, err := callerNamespace(ctx)
	if err != nil {
		return nil, err
	}

	resp, err := s.clientFor(namespace).GetTokenByHash(ctx, &satokenpb.GetTokenByHashRequest{
		Namespace: namespace,
		Hash:      hash,
	})
	if err != nil {
		return nil, mapError(err, "getting token by hash")
	}

	return fromProto(resp.GetToken()), nil
}

// UpdateLastUsedDate stamps the token's last_used_at. The namespace is taken from
// the caller's identity on ctx.
func (s *store) UpdateLastUsedDate(ctx context.Context, id string) error {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenGrpcStore.UpdateLastUsedDate")
	defer span.End()

	namespace, err := callerNamespace(ctx)
	if err != nil {
		return err
	}

	if _, err := s.clientFor(namespace).UpdateTokenLastUsedDate(ctx, &satokenpb.UpdateTokenLastUsedDateRequest{
		Namespace: namespace,
		Id:        id,
	}); err != nil {
		return mapError(err, "updating token last used date")
	}

	return nil
}

func (s *store) Delete(ctx context.Context, namespace, serviceAccountName, name string) error {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenGrpcStore.Delete")
	defer span.End()

	if _, err := s.clientFor(namespace).DeleteToken(ctx, &satokenpb.DeleteTokenRequest{
		Namespace:          namespace,
		ServiceAccountName: serviceAccountName,
		Name:               name,
	}); err != nil {
		return mapError(err, "deleting token")
	}

	return nil
}

// callerNamespace reads the namespace off the identity on ctx, for the calls whose
// signature carries no namespace.
func callerNamespace(ctx context.Context) (string, error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok || authInfo.GetNamespace() == "" {
		return "", fmt.Errorf("a namespaced caller identity is required")
	}
	return authInfo.GetNamespace(), nil
}

// mapError converts gRPC status codes back into the sentinels callers branch on.
func mapError(err error, action string) error {
	switch status.Code(err) {
	case codes.AlreadyExists:
		return errors.Join(satoken.ErrTokenDuplicate, err)
	case codes.NotFound:
		return errors.Join(satoken.ErrTokenNotFound, err)
	default:
		return fmt.Errorf("%s: %w", action, err)
	}
}

func fromProto(t *satokenpb.Token) *satoken.Token {
	isRevoked := t.GetIsRevoked()
	token := &satoken.Token{
		ID:                 t.GetId(),
		Namespace:          t.GetNamespace(),
		Name:               t.GetName(),
		ServiceAccountName: t.GetServiceAccountName(),
		Created:            time.Unix(t.GetCreated(), 0).UTC(),
		Updated:            time.Unix(t.GetUpdated(), 0).UTC(),
		IsRevoked:          &isRevoked,
	}
	// 0 is the zero value for both fields on the wire and means "unset".
	if lastUsedAt := t.GetLastUsedAt(); lastUsedAt != 0 {
		ts := time.Unix(lastUsedAt, 0).UTC()
		token.LastUsedAt = &ts
	}
	if expires := t.GetExpires(); expires != 0 {
		token.Expires = &expires
	}
	return token
}
