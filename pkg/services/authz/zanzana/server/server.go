package server

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/protobuf/types/known/wrapperspb"

	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	zStore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
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

	openFGAServer OpenFGAServer
	openFGAClient openfgav1.OpenFGAServiceClient
	store         storage.OpenFGADatastore

	cfg      setting.ZanzanaServerSettings
	stores   map[string]storeInfo
	storesMU *sync.Mutex
	cache    *localcache.CacheService

	logger  log.Logger
	tracer  tracing.Tracer
	metrics *metrics
}

type storeInfo struct {
	ID      string
	ModelID string
}

func NewEmbeddedZanzanaServer(cfg *setting.Cfg, db db.DB, logger log.Logger, tracer tracing.Tracer, reg prometheus.Registerer) (*Server, error) {
	store, err := zStore.NewEmbeddedStore(cfg, db, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to start zanzana: %w", err)
	}

	openfga, err := NewOpenFGAServer(cfg.ZanzanaServer, store)
	if err != nil {
		return nil, fmt.Errorf("failed to start zanzana: %w", err)
	}

	return newServer(cfg, openfga, store, logger, tracer, reg)
}

func NewZanzanaServer(cfg *setting.Cfg, logger log.Logger, tracer tracing.Tracer, reg prometheus.Registerer) (*Server, error) {
	store, err := zStore.NewStore(cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to initilize zanana store: %w", err)
	}

	openfgaServer, err := NewOpenFGAServer(cfg.ZanzanaServer, store)
	if err != nil {
		return nil, fmt.Errorf("failed to start zanzana: %w", err)
	}

	return newServer(cfg, openfgaServer, store, logger, tracer, reg)
}

func newServer(cfg *setting.Cfg, openfga OpenFGAServer, store storage.OpenFGADatastore, logger log.Logger, tracer tracing.Tracer, reg prometheus.Registerer) (*Server, error) {
	channel := &inprocgrpc.Channel{}
	openfgav1.RegisterOpenFGAServiceServer(channel, openfga)
	openFGAClient := openfgav1.NewOpenFGAServiceClient(channel)

	zanzanaCfg := cfg.ZanzanaServer

	s := &Server{
		openFGAServer: openfga,
		openFGAClient: openFGAClient,
		store:         store,
		storesMU:      &sync.Mutex{},
		stores:        make(map[string]storeInfo),
		cfg:           zanzanaCfg,
		cache:         localcache.New(zanzanaCfg.CacheSettings.CheckQueryCacheTTL, cacheCleanInterval),
		logger:        logger,
		tracer:        tracer,
		metrics:       newZanzanaServerMetrics(reg),
	}

	return s, nil
}

func (s *Server) GetOpenFGAServer() openfgav1.OpenFGAServiceServer {
	return s.openFGAServer
}

func (s *Server) IsHealthy(ctx context.Context) (bool, error) {
	_, err := s.openFGAClient.ListStores(ctx, &openfgav1.ListStoresRequest{
		PageSize: wrapperspb.Int32(1),
	})
	return err == nil, nil
}

func (s *Server) Close() {
	s.store.Close()
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
					dashboardV2beta1.DashboardResourceInfo.GroupResource().Group,
					dashboardV2beta1.DashboardResourceInfo.GroupResource().Resource,
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
