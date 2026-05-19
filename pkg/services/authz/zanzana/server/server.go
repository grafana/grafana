package server

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/semaphore"
	"golang.org/x/sync/singleflight"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/protobuf/types/known/wrapperspb"
	"k8s.io/apimachinery/pkg/runtime/schema"
	clientrest "k8s.io/client-go/rest"

	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/apiserver"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/server/reconciler"
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
	stores   map[string]zanzana.StoreInfo
	storesMU sync.RWMutex
	storeSF  singleflight.Group
	cache    *localcache.CacheService

	mtReconciler zanzana.MTReconciler

	logger  log.Logger
	tracer  tracing.Tracer
	metrics *metrics

	globalSem         *semaphore.Weighted
	namespaceLimiters sync.Map
	nsLimiterSize     int64
}

func NewEmbeddedZanzanaServer(cfg *setting.Cfg, store storage.OpenFGADatastore, logger log.Logger, tracer tracing.Tracer, reg prometheus.Registerer, restConfig apiserver.RestConfigProvider, reconcileCRDs []schema.GroupVersionResource) (*Server, error) {
	openfga, err := NewOpenFGAServer(cfg.ZanzanaServer, store)
	if err != nil {
		return nil, fmt.Errorf("failed to start zanzana: %w", err)
	}

	return newServer(cfg, openfga, store, logger, tracer, reg, restConfig, reconcileCRDs)
}

func NewZanzanaServer(cfg *setting.Cfg, store storage.OpenFGADatastore, logger log.Logger, tracer tracing.Tracer, reg prometheus.Registerer, reconcileCRDs []schema.GroupVersionResource) (*Server, error) {
	openfgaServer, err := NewOpenFGAServer(cfg.ZanzanaServer, store)
	if err != nil {
		return nil, fmt.Errorf("failed to start zanzana: %w", err)
	}

	return newServer(cfg, openfgaServer, store, logger, tracer, reg, nil, reconcileCRDs)
}

func newServer(cfg *setting.Cfg, openfga OpenFGAServer, store storage.OpenFGADatastore, logger log.Logger, tracer tracing.Tracer, reg prometheus.Registerer, restConfig apiserver.RestConfigProvider, reconcileCRDs []schema.GroupVersionResource) (*Server, error) {
	channel := &inprocgrpc.Channel{}
	openfgav1.RegisterOpenFGAServiceServer(channel, openfga)
	openFGAClient := openfgav1.NewOpenFGAServiceClient(channel)

	zanzanaCfg := cfg.ZanzanaServer

	s := &Server{
		openFGAServer: openfga,
		openFGAClient: openFGAClient,
		store:         store,
		stores:        make(map[string]zanzana.StoreInfo),
		cfg:           zanzanaCfg,
		cache:         localcache.New(zanzanaCfg.CacheSettings.CheckQueryCacheTTL, cacheCleanInterval),
		logger:        logger,
		tracer:        tracer,
		metrics:       newZanzanaServerMetrics(reg),
		nsLimiterSize: int64(zanzanaCfg.MaxConcurrentRequestsPerNamespace),
	}

	if zanzanaCfg.MaxConcurrentRequests > 0 {
		s.globalSem = semaphore.NewWeighted(int64(zanzanaCfg.MaxConcurrentRequests))
	}

	var clientFactory resources.ClientFactory
	if cfg.ZanzanaReconciler.Mode == setting.ZanzanaReconcilerModeMT {
		if restConfig != nil {
			// Embedded mode: use LoopbackClientConfig via the eventual provider
			clientFactory = resources.NewClientFactory(restConfig)
		} else {
			// Standalone mode: use explicit URLs with token exchange
			if cfg.ZanzanaReconciler.FolderAPIServerURL == "" {
				return nil, fmt.Errorf("reconciler_folder_apiserver_url must be set when reconciler mode is mt")
			}
			if cfg.ZanzanaReconciler.IAMAPIServerURL == "" {
				return nil, fmt.Errorf("reconciler_iam_apiserver_url must be set when reconciler mode is mt")
			}

			grpcAuthSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
			token := grpcAuthSection.Key("token").MustString("")
			tokenExchangeURL := grpcAuthSection.Key("token_exchange_url").MustString("")

			if token == "" || tokenExchangeURL == "" {
				return nil, fmt.Errorf("token and token_exchange_url must be set in [grpc_client_authentication] when reconciler is enabled")
			}

			tokenExchangeClient, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
				Token:            token,
				TokenExchangeURL: tokenExchangeURL,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to create token exchange client: %w", err)
			}

			// Build per-group REST configs with group-specific audiences
			configProviders := make(map[string]apiserver.RestConfigProvider)
			apiServerURLs := map[string]string{
				"folder.grafana.app": cfg.ZanzanaReconciler.FolderAPIServerURL,
				"iam.grafana.app":    cfg.ZanzanaReconciler.IAMAPIServerURL,
			}

			for group, url := range apiServerURLs {
				// Each API group gets its own audience for proper token scoping
				audienceProvider := clientauth.NewStaticAudienceProvider(group)
				namespaceProvider := clientauth.NewStaticNamespaceProvider(clientauth.WildcardNamespace)

				standaloneRestConfig := &clientrest.Config{
					Host:    url,
					APIPath: "/apis",
					TLSClientConfig: clientrest.TLSClientConfig{
						Insecure: cfg.ZanzanaReconciler.TLSInsecure,
					},
					WrapTransport: clientauth.NewTokenExchangeTransportWrapper(
						tokenExchangeClient,
						audienceProvider,
						namespaceProvider,
					),
				}

				configProviders[group] = apiserver.RestConfigProviderFunc(func(_ context.Context) (*clientrest.Config, error) {
					return standaloneRestConfig, nil
				})
			}

			clientFactory = resources.NewClientFactoryForMultipleAPIServers(configProviders)
		}
	}

	var mtReconciler zanzana.MTReconciler
	if cfg.ZanzanaReconciler.Mode == setting.ZanzanaReconcilerModeMT {
		reconcilerLogger := log.New("zanzana.mt-reconciler")

		var le leaderelection.Elector
		if cfg.ZanzanaReconciler.LeaderElection.Enabled {
			restCfg, err := clientrest.InClusterConfig()
			if err != nil {
				return nil, fmt.Errorf("failed to get in-cluster config for leader election: %w", err)
			}
			le, err = leaderelection.NewKubernetesElector(
				restCfg,
				cfg.ZanzanaReconciler.LeaderElection,
				reconcilerLogger,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to create leader elector: %w", err)
			}
		} else {
			le = leaderelection.NewDefaultElector()
		}

		mtReconciler = reconciler.NewReconciler(
			s,
			clientFactory,
			reconciler.Config{
				Workers:             cfg.ZanzanaReconciler.Workers,
				Interval:            cfg.ZanzanaReconciler.Interval,
				WriteBatchSize:      cfg.ZanzanaReconciler.WriteBatchSize,
				ZanzanaReadPageSize: int(cfg.ZanzanaServer.ReadPageSize),
				QueueSize:           cfg.ZanzanaReconciler.QueueSize,
				ListPageSize:        cfg.ZanzanaReconciler.ListPageSize,
				CRDs:                reconcileCRDs,
			},
			reconcilerLogger,
			tracer,
			reg,
			le,
		)
	} else {
		mtReconciler = reconciler.NewNoopReconciler()
	}

	s.mtReconciler = mtReconciler

	return s, nil
}

func (s *Server) RunReconciler(ctx context.Context) error {
	if s.mtReconciler == nil {
		s.logger.Error("mt reconciler is not initialized")
		return nil
	}

	return s.mtReconciler.Run(ctx)
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

		contextuals = append(
			contextuals,
			&openfgav1.TupleKey{
				User:     subject,
				Relation: common.RelationSetView,
				Object: common.NewGroupResourceIdent(
					folders.FolderResourceInfo.GroupResource().Group,
					folders.FolderResourceInfo.GroupResource().Resource,
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
