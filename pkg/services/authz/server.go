package authz

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authzv1.AuthzServiceServer = (*legacyServer)(nil)

type legacyServer struct {
	authzv1.UnimplementedAuthzServiceServer

	acSvc  accesscontrol.Service
	logger log.Logger
	tracer tracing.Tracer
}

func newLegacyServer(
	authCfg *Cfg,
	acSvc accesscontrol.Service, features featuremgmt.FeatureToggles,
	grpcServer grpcserver.Provider, tracer tracing.Tracer,
) (*legacyServer, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	s := &legacyServer{
		acSvc:  acSvc,
		logger: log.New("authz-grpc-server"),
		tracer: tracer,
	}

	if authCfg.listen {
		if authCfg.env == setting.Dev {
			grpcServer.GetServer().RegisterService(&authzv1.AuthzService_ServiceDesc, s)
		} else {
			// FIXME: Once we have access-token support, we can enable this in production
			s.logger.Warn("authz grpc server is disabled in production mode as authentication cannot yet be performed")
		}
	}

	return s, nil
}

// FIXME: Hack to override the authentication given we don't have access tokens yet
func (s *legacyServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return ctx, nil
}

func (s *legacyServer) Read(ctx context.Context, req *authzv1.ReadRequest) (*authzv1.ReadResponse, error) {
	ctx, span := s.tracer.Start(ctx, "authz.grpc.Read")
	defer span.End()

	action := req.GetAction()
	subject := req.GetSubject()
	stackID := req.GetStackId() // TODO can we consider the stackID as the orgID?

	ctxLogger := s.logger.FromContext(ctx)
	ctxLogger.Debug("Read", "action", action, "subject", subject, "stackID", stackID)

	permissions, err := s.acSvc.SearchUserPermissions(ctx, stackID, accesscontrol.SearchOptions{NamespacedID: subject, Action: action})
	if err != nil {
		ctxLogger.Error("failed to search user permissions", "error", err)
		return nil, tracing.Errorf(span, "failed to search user permissions: %w", err)
	}

	data := make([]*authzv1.ReadResponse_Data, 0, len(permissions))
	for _, perm := range permissions {
		data = append(data, &authzv1.ReadResponse_Data{Object: perm.Scope})
	}
	return &authzv1.ReadResponse{Data: data}, nil
}
