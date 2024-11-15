package rbac

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type Service struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	store  *store.Store
	logger log.Logger
	tracer tracing.Tracer
}

func NewService(sql legacysql.LegacyDatabaseProvider, logger log.Logger, tracer tracing.Tracer) *Service {
	return &Service{
		store:  store.NewStore(sql),
		logger: logger,
		tracer: tracer,
	}
}

func (s *Service) Check(ctx context.Context, req *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ns := req.GetNamespace()
	ctx = request.WithNamespace(ctx, ns)

	return nil, nil
}
