package authz

// ---
// - Not removing this yet, still deciding on the approach to follow: middleware vs handler level checks
// - Currently favoring the handler level checks, as it's service specific, more efficient, flexible and doesn't require parsing requests and responses.
// - This middleware will probably be changed to check JWT access tokens (audience, namespace)
// ---
//
//
// type contextKey string

// const AuthZParamsContextKey contextKey = "AuthZParams"

// type AuthZParams struct {
// 	Method string
// 	Key    []*entity.Key
// 	Kind   []string
// 	Folder string
// }

// // ServiceAuthzFuncOverride is an interface that can be implemented by a service to override the default
// // authorization behavior.
// type ServiceAuthzFuncOverride interface {
// 	AuthZFuncOverride(ctx context.Context, method string) (context.Context, error)
// }

// func AuthZUnaryInterceptor(authorizer Authorizer) grpc.UnaryServerInterceptor {
// 	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
// 		var newCtx context.Context
// 		if ovverideSrv, ok := info.Server.(ServiceAuthzFuncOverride); ok {
// 			newCtx, err = ovverideSrv.AuthZFuncOverride(ctx, info.FullMethod)
// 			if err != nil {
// 				return nil, err
// 			}
// 		} else {
// 			authzParams, err := extractRequestEntityData(info, req)
// 			if err != nil {
// 				return nil, err
// 			}

// 			newCtx, err = authorizer.Authorize(ctx, authzParams)
// 			if err != nil {
// 				return nil, err
// 			}
// 		}

// 		return handler(newCtx, req)
// 	}
// }

// func AuthZStreamInterceptor(authorizer Authorizer) grpc.StreamServerInterceptor {
// 	return func(srv any, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
// 		authzStream := &authzServerStream{
// 			ServerStream: stream,
// 			authorizer:   authorizer,
// 		}

// 		var newCtx context.Context
// 		var err error
// 		if overrideSrv, ok := srv.(ServiceAuthzFuncOverride); ok {
// 			newCtx, err = overrideSrv.AuthZFuncOverride(stream.Context(), info.FullMethod)
// 			authzStream.skipAuthZ = true
// 		} else {
// 			newCtx = stream.Context()
// 			// TODO: implement authorize for stream requests
// 		}
// 		if err != nil {
// 			return err
// 		}

// 		authzStream.ctx = newCtx
// 		return handler(srv, authzStream)
// 	}
// }

// type authzServerStream struct {
// 	grpc.ServerStream
// 	authorizer Authorizer
// 	ctx        context.Context
// 	skipAuthZ  bool
// }

// func (s *authzServerStream) Context() context.Context {
// 	return s.ctx
// }

// func (w *authzServerStream) RecvMsg(m any) error {
// 	return w.ServerStream.RecvMsg(m)
// }

// func (w *authzServerStream) SendMsg(m any) error {
// 	if w.skipAuthZ {
// 		return w.ServerStream.SendMsg(m)
// 	}

// 	if parsedRes, ok := m.(*entity.EntityWatchResponse); ok {
// 		key, _ := entity.ParseKey(parsedRes.Entity.Key)
// 		authzParams := &AuthZParams{
// 			Key:    []*entity.Key{key},
// 			Kind:   []string{parsedRes.Entity.Resource},
// 			Folder: parsedRes.Entity.Folder,
// 		}

// 		_, err := w.authorizer.Authorize(w.ctx, authzParams)
// 		if err == nil {
// 			// Not calling SendMsg() means the entity is not sent back to the client.
// 			return w.ServerStream.SendMsg(m)
// 		}
// 		// Failed to authorize, don't send the entity back to the client.
// 		return err
// 	}

// 	// TODO: implement authorize for other stream requests
// 	return status.Error(codes.Internal, "unhandled stream message type")
// }

// func extractRequestEntityData(info *grpc.UnaryServerInfo, req any) (*AuthZParams, error) {
// 	authzParams := &AuthZParams{}
// 	switch info.FullMethod {
// 	case "/entity.EntityStore/Read":
// 		parsedReq, ok := req.(*entity.ReadEntityRequest)
// 		if !ok {
// 			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Read: expected *ReadEntityRequest, got %T", req)
// 		}

// 		key, _ := entity.ParseKey(parsedReq.Key)
// 		authzParams.Key = []*entity.Key{key}
// 		authzParams.Kind = []string{key.Resource}
// 		// TODO: get the containing folder
// 		// authzParams.Folder =
// 	case "/entity.EntityStore/Create":
// 		parsedReq, ok := req.(*entity.CreateEntityRequest)
// 		if !ok {
// 			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Create: expected *CreateEntityRequest, got %T", req)
// 		}

// 		key, _ := entity.ParseKey(parsedReq.Entity.Key)
// 		authzParams.Key = []*entity.Key{key}
// 		authzParams.Kind = []string{parsedReq.Entity.Resource}
// 		authzParams.Folder = parsedReq.Entity.Folder
// 	case "/entity.EntityStore/Update":
// 		_, ok := req.(*entity.UpdateEntityRequest)
// 		if !ok {
// 			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Update: expected *UpdateEntityRequest, got %T", req)
// 		}
// 	case "/entity.EntityStore/Delete":
// 		_, ok := req.(*entity.DeleteEntityRequest)
// 		if !ok {
// 			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Delete: expected *DeleteEntityRequest, got %T", req)
// 		}
// 	case "/entity.EntityStore/History":
// 		_, ok := req.(*entity.EntityHistoryRequest)
// 		if !ok {
// 			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/History: expected *EntityHistoryRequest, got %T", req)
// 		}
// 	case "/entity.EntityStore/List":
// 		parsedReq, ok := req.(*entity.EntityListRequest)
// 		if !ok {
// 			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/List: expected *EntityListRequest, got %T", req)
// 		}

// 		authzParams.Key = keyListToKeys(parsedReq.Key)
// 		authzParams.Kind = parsedReq.Resource
// 		authzParams.Folder = parsedReq.Folder
// 	case "/entity.EntityStore/Watch":
// 		_, ok := req.(*entity.EntityWatchRequest)
// 		if !ok {
// 			return nil, fmt.Errorf("incorrect type for /entity.EntityStore/Watch: expected *EntityWatchRequest, got %T", req)
// 		}
// 	default:
// 		return nil, fmt.Errorf("method %s not supported", info.FullMethod)
// 	}

// 	authzParams.Method = info.FullMethod
// 	return authzParams, nil
// }

// func keyListToKeys(keyList []string) []*entity.Key {
// 	keys := make([]*entity.Key, 0, len(keyList))
// 	for _, k := range keyList {
// 		key, _ := entity.ParseKey(k)
// 		keys = append(keys, key)
// 	}
// 	return keys
// }
