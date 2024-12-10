package server

import (
	"sync"
	"time"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/transformer"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	resourceType     = "resource"
	namespaceType    = "namespace"
	folderTypePrefix = "folder:"

	cacheCleanInterval = 2 * time.Minute
)

var _ authzv1.AuthzServiceServer = (*Server)(nil)
var _ authzextv1.AuthzExtentionServiceServer = (*Server)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/server")

type Server struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	openfga       openfgav1.OpenFGAServiceServer
	openfgaClient openfgav1.OpenFGAServiceClient

	cfg      setting.ZanzanaSettings
	logger   log.Logger
	modules  []transformer.ModuleFile
	stores   map[string]storeInfo
	storesMU *sync.Mutex
	cache    *localcache.CacheService
}

type storeInfo struct {
	ID      string
	ModelID string
}

type ServerOption func(s *Server)

func WithLogger(logger log.Logger) ServerOption {
	return func(s *Server) {
		s.logger = logger
	}
}

func WithSchema(modules []transformer.ModuleFile) ServerOption {
	return func(s *Server) {
		s.modules = modules
	}
}

func NewAuthzServer(cfg *setting.Cfg, openfga openfgav1.OpenFGAServiceServer) (*Server, error) {
	return NewAuthz(cfg, openfga)
}

func NewAuthz(cfg *setting.Cfg, openfga openfgav1.OpenFGAServiceServer, opts ...ServerOption) (*Server, error) {
	channel := &inprocgrpc.Channel{}
	openfgav1.RegisterOpenFGAServiceServer(channel, openfga)
	openFGAClient := openfgav1.NewOpenFGAServiceClient(channel)

	s := &Server{
		openfga:       openfga,
		openfgaClient: openFGAClient,
		storesMU:      &sync.Mutex{},
		stores:        make(map[string]storeInfo),
		cfg:           cfg.Zanzana,
		cache:         localcache.New(cfg.Zanzana.CheckQueryCacheTTL, cacheCleanInterval),
	}

	for _, o := range opts {
		o(s)
	}

	if s.logger == nil {
		s.logger = log.New("authz-server")
	}

	return s, nil
}
