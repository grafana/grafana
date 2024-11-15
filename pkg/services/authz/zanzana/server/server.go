package server

import (
	"sync"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/transformer"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	resourceType     = "resource"
	namespaceType    = "namespace"
	folderTypePrefix = "folder:"
)

var _ authzv1.AuthzServiceServer = (*Server)(nil)
var _ authzextv1.AuthzExtentionServiceServer = (*Server)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/server")

type Server struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	openfga openfgav1.OpenFGAServiceServer

	logger   log.Logger
	modules  []transformer.ModuleFile
	stores   map[string]storeInfo
	storesMU *sync.Mutex
}

type storeInfo struct {
	Id                   string
	AuthorizationModelId string
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
	return NewAuthz(openfga)
}

func NewAuthz(openfga openfgav1.OpenFGAServiceServer, opts ...ServerOption) (*Server, error) {
	s := &Server{
		openfga:  openfga,
		storesMU: &sync.Mutex{},
		stores:   make(map[string]storeInfo),
	}

	for _, o := range opts {
		o(s)
	}

	if s.logger == nil {
		s.logger = log.New("authz-server")
	}

	return s, nil
}
