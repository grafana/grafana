package server

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel"
	"google.golang.org/protobuf/types/known/wrapperspb"

	dashboardalpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/setting"
)

const cacheCleanInterval = 2 * time.Minute

var _ authzv1.AuthzServiceServer = (*Server)(nil)
var _ authzextv1.AuthzExtentionServiceServer = (*Server)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/server")

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
	logger   log.Logger
	stores   map[string]storeInfo
	storesMU *sync.Mutex
	cache    *localcache.CacheService
}

type storeInfo struct {
	ID      string
	ModelID string
}

func NewServer(cfg setting.ZanzanaServerSettings, openfga OpenFGAServer, logger log.Logger) (*Server, error) {
	channel := &inprocgrpc.Channel{}
	openfgav1.RegisterOpenFGAServiceServer(channel, openfga)
	openFGAClient := openfgav1.NewOpenFGAServiceClient(channel)

	s := &Server{
		openfga:       openfga,
		openfgaClient: openFGAClient,
		storesMU:      &sync.Mutex{},
		stores:        make(map[string]storeInfo),
		cfg:           cfg,
		cache:         localcache.New(cfg.CheckQueryCacheTTL, cacheCleanInterval),
		logger:        logger,
	}

	return s, nil
}

func (s *Server) IsHealthy(ctx context.Context) (bool, error) {
	// FIXME: get back to openfga.IsReady() when issue is fixed
	// https://github.com/openfga/openfga/issues/2251
	_, err := s.openfga.ListStores(ctx, &openfgav1.ListStoresRequest{
		PageSize: wrapperspb.Int32(1),
	})
	return err == nil, nil
}

func (s *Server) getContextuals(ctx context.Context, subject string) (*openfgav1.ContextualTupleKeys, error) {
	contextuals, err := s.getGlobalAuthorizationContext(ctx)
	if err != nil {
		return nil, err
	}

	if strings.HasPrefix(subject, common.TypeRenderService+":") {
		contextuals = append(
			contextuals,
			&openfgav1.TupleKey{
				User:     subject,
				Relation: common.RelationSetView,
				Object: common.NewGroupResourceIdent(
					dashboardalpha1.DashboardResourceInfo.GroupResource().Group,
					dashboardalpha1.DashboardResourceInfo.GroupResource().Resource,
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

func (s *Server) getGlobalAuthorizationContext(ctx context.Context) ([]*openfgav1.TupleKey, error) {
	const cacheKey = "global_authorization_context"
	cached, found := s.cache.Get(cacheKey)
	if found {
		return cached.([]*openfgav1.TupleKey), nil
	}

	res, err := s.Read(ctx, &authzextv1.ReadRequest{
		Namespace: common.ClusterNamespace,
	})
	if err != nil {
		return nil, err
	}

	contextualTuples := make([]*openfgav1.TupleKey, 0, len(res.GetTuples()))
	tuples := common.ToOpenFGATuples(res.GetTuples())
	for _, t := range tuples {
		contextualTuples = append(contextualTuples, t.GetKey())
	}

	s.cache.SetDefault(cacheKey, contextualTuples)
	return contextualTuples, nil
}
