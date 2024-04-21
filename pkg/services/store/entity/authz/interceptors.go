package authz

import (
	"context"
	"fmt"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/services/store/entity"
)

type contextKey string

const AuthZParamsContextKey contextKey = "AuthZParams"

type AuthZParams struct {
	Method string
	Key    []*entity.Key
	Kind   []string
	Folder string
}

func AuthZUnaryInterceptor(authorizer Authorizer) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
		authzParams, err := extractRequestEntityData(info, req)
		if err != nil {
			return nil, err
		}

		ctx, err = authorizer.Authorize(ctx, authzParams)
		if err != nil {
			return nil, err
		}

		return handler(ctx, req)
	}
}

func AuthZStreamInterceptor(authorizer Authorizer) grpc.StreamServerInterceptor {
	return func(srv any, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		// TODO: because this is a stream interceptor, it requires more work
		// to be functionally comparable to the unary interceptor

		// authzParams, err := extractRequestEntityData(info, req)
		// if err != nil {
		// 	return err
		// }
		//
		// ctx, err := authorizer.Authorize(ctx, &AuthZParams{})
		// if err != nil {
		// 	return err
		// }
		//
		// wrappedStream := grpc_middleware.WrapServerStream(stream)
		// wrappedStream.WrappedContext = ctx
		// return handler(srv, wrappedStream)

		return handler(srv, stream)
	}
}

func extractRequestEntityData(info *grpc.UnaryServerInfo, req any) (*AuthZParams, error) {
	authzParams := &AuthZParams{}
	switch info.FullMethod {
	case "/entity.EntityStore/Read":
		_, ok := req.(*entity.ReadEntityRequest)
		if !ok {
			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Read: expected *ReadEntityRequest, got %T", req)
		}
	case "/entity.EntityStore/Create":
		e, ok := req.(*entity.CreateEntityRequest)
		if !ok {
			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Create: expected *CreateEntityRequest, got %T", req)
		}

		key, _ := entity.ParseKey(e.Entity.Key)
		authzParams.Key = []*entity.Key{key}
		authzParams.Kind = []string{e.Entity.Resource}
		authzParams.Folder = e.Entity.Folder

	case "/entity.EntityStore/Update":
		_, ok := req.(*entity.UpdateEntityRequest)
		if !ok {
			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Update: expected *UpdateEntityRequest, got %T", req)
		}
	case "/entity.EntityStore/Delete":
		_, ok := req.(*entity.DeleteEntityRequest)
		if !ok {
			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Delete: expected *DeleteEntityRequest, got %T", req)
		}
	case "/entity.EntityStore/History":
		_, ok := req.(*entity.EntityHistoryRequest)
		if !ok {
			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/History: expected *EntityHistoryRequest, got %T", req)
		}
	case "/entity.EntityStore/List":
		entity, ok := req.(*entity.EntityListRequest)
		if !ok {
			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/List: expected *EntityListRequest, got %T", req)
		}

		authzParams.Key = keyListToKeys(entity.Key)
		authzParams.Kind = entity.Resource
		authzParams.Folder = entity.Folder

	case "/entity.EntityStore/Watch":
		_, ok := req.(*entity.EntityWatchRequest)
		if !ok {
			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Watch: expected *EntityWatchRequest, got %T", req)
		}
	default:
		return nil, fmt.Errorf("method %s not supported", info.FullMethod)
	}

	authzParams.Method = info.FullMethod
	return authzParams, nil
}

func keyListToKeys(keyList []string) []*entity.Key {
	keys := make([]*entity.Key, 0, len(keyList))
	for _, k := range keyList {
		key, _ := entity.ParseKey(k)
		keys = append(keys, key)
	}
	return keys
}
