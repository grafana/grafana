package authz

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
)

var _ authzv1.AuthzServiceServer = (*legacyServer)(nil)

type legacyServer struct {
	authzv1.UnimplementedAuthzServiceServer

	acSvc  accesscontrol.Service
	logger log.Logger
	tracer tracing.Tracer
}

func newLegacyServer(
	acSvc accesscontrol.Service, features featuremgmt.FeatureToggles,
	grpcServer grpcserver.Provider, tracer tracing.Tracer, cfg *Cfg,
) (*legacyServer, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	s := &legacyServer{
		acSvc:  acSvc,
		logger: log.New("authz-grpc-server"),
		tracer: tracer,
	}

	if cfg.listen {
		grpcServer.GetServer().RegisterService(&authzv1.AuthzService_ServiceDesc, s)
	}

	return s, nil
}

func (s *legacyServer) Read(ctx context.Context, req *authzv1.ReadRequest) (*authzv1.ReadResponse, error) {
	ctx, span := s.tracer.Start(ctx, "authz.grpc.Read")
	defer span.End()

	// FIXME: once we have access tokens, we need to do namespace validation here

	action := req.GetAction()
	subject := req.GetSubject()
	stackID := req.GetStackId() // TODO can we consider the stackID as the orgID?

	ctxLogger := s.logger.FromContext(ctx)
	ctxLogger.Debug("Read", "action", action, "subject", subject, "stackID", stackID)

	var err error
	opts := accesscontrol.SearchOptions{Action: action}
	if subject != "" {
		opts.TypedID, err = identity.ParseTypedID(subject)
		if err != nil {
			return nil, err
		}
	}

	permissions, err := s.acSvc.SearchUserPermissions(ctx, stackID, opts)
	if err != nil {
		ctxLogger.Error("failed to search user permissions", "error", err)
		return nil, tracing.Errorf(span, "failed to search user permissions: %w", err)
	}

	data := make([]*authzv1.ReadResponse_Data, 0, len(permissions))
	for _, perm := range permissions {
		data = append(data, &authzv1.ReadResponse_Data{Object: perm.Scope})
	}
	return &authzv1.ReadResponse{
		Data:  data,
		Found: len(data) > 0,
	}, nil
}
