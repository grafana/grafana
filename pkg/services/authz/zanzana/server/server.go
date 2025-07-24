package server

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/wrapperspb"

	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2alpha2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha2"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/setting"
)

const cacheCleanInterval = 2 * time.Minute

var _ authzv1.AuthzServiceServer = (*Server)(nil)
var _ authzextv1.AuthzExtentionServiceServer = (*Server)(nil)

type OpenFGAServer interface {
	openfgav1.OpenFGAServiceServer
	IsReady(ctx context.Context) (bool, error)
}

type Server struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	openfga       OpenFGAServer
	openfgaClient openfgav1.OpenFGAServiceClient

	cfg      setting.ZanzanaServerSettings
	stores   map[string]storeInfo
	storesMU *sync.Mutex
	cache    *localcache.CacheService

	logger log.Logger
	tracer tracing.Tracer
}

type storeInfo struct {
	ID      string
	ModelID string
}

func NewServer(cfg setting.ZanzanaServerSettings, openfga OpenFGAServer, logger log.Logger, tracer tracing.Tracer) (*Server, error) {
	channel := &inprocgrpc.Channel{}
	openfgav1.RegisterOpenFGAServiceServer(channel, openfga)
	openFGAClient := openfgav1.NewOpenFGAServiceClient(channel)

	s := &Server{
		openfga:       openfga,
		openfgaClient: openFGAClient,
		storesMU:      &sync.Mutex{},
		stores:        make(map[string]storeInfo),
		cfg:           cfg,
		cache:         localcache.New(cfg.CacheSettings.CheckQueryCacheTTL, cacheCleanInterval),
		logger:        logger,
		tracer:        tracer,
	}

	return s, nil
}

func (s *Server) IsHealthy(ctx context.Context) (bool, error) {
	_, err := s.openfga.ListStores(ctx, &openfgav1.ListStoresRequest{
		PageSize: wrapperspb.Int32(1),
	})
	return err == nil, nil
}

func (s *Server) getContextuals(subject string) (*openfgav1.ContextualTupleKeys, error) {
	contextuals := make([]*openfgav1.TupleKey, 0)

	if strings.HasPrefix(subject, common.TypeRenderService+":") {
		contextuals = append(
			contextuals,
			&openfgav1.TupleKey{
				User:     subject,
				Relation: common.RelationSetView,
				Object: common.NewGroupResourceIdent(
					dashboardV2alpha1.DashboardResourceInfo.GroupResource().Group,
					dashboardV2alpha1.DashboardResourceInfo.GroupResource().Resource,
					"",
				),
			},
		)

		contextuals = append(
			contextuals,
			&openfgav1.TupleKey{
				User:     subject,
				Relation: common.RelationSetView,
				Object: common.NewGroupResourceIdent(
					dashboardV2alpha2.DashboardResourceInfo.GroupResource().Group,
					dashboardV2alpha2.DashboardResourceInfo.GroupResource().Resource,
					"",
				),
			},
		)
	}

	if len(contextuals) > 0 {
		return &openfgav1.ContextualTupleKeys{TupleKeys: contextuals}, nil
	}

	return nil, nil
}
