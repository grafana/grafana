package authz

import (
	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

func RegisterRBACAuthZService(handler grpcserver.Provider, db legacysql.LegacyDatabaseProvider, tracer tracing.Tracer) {
	server := rbac.NewService(db, legacy.NewLegacySQLStores(db), log.New("authz-grpc-server"), tracer)

	srv := handler.GetServer()
	authzv1.RegisterAuthzServiceServer(srv, server)
	authzextv1.RegisterAuthzExtentionServiceServer(srv, server)
}
