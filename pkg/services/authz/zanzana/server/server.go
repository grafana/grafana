package server

import (
	"context"
	"errors"
	"fmt"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/transformer"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	resourceType     = "resource"
	namespaceType    = "namespace"
	folderTypePrefix = "folder2:"
)

var _ authzv1.AuthzServiceServer = (*Server)(nil)
var _ authzextv1.AuthzExtentionServiceServer = (*Server)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/server")

var errStoreNotFound = errors.New("store not found")

type Server struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	openfga openfgav1.OpenFGAServiceServer

	logger   log.Logger
	modules  []transformer.ModuleFile
	tenantID string
	storeID  string
	modelID  string

	storeMap map[string]string
}

type ServerOption func(s *Server)

func WithTenantID(tenantID string) ServerOption {
	return func(s *Server) {
		s.tenantID = tenantID
	}
}

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
	stackID := cfg.StackID
	if stackID == "" {
		stackID = "default"
	}

	return NewAuthz(
		openfga,
		WithTenantID(fmt.Sprintf("stacks-%s", stackID)),
	)
}

func NewAuthz(openfga openfgav1.OpenFGAServiceServer, opts ...ServerOption) (*Server, error) {
	s := &Server{openfga: openfga}

	for _, o := range opts {
		o(s)
	}

	if s.logger == nil {
		s.logger = log.New("authz-server")
	}

	if s.tenantID == "" {
		s.tenantID = "stacks-default"
	}

	if len(s.modules) == 0 {
		s.modules = schema.SchemaModules
	}

	ctx := context.Background()
	err := s.initStores(ctx)
	if err != nil {
		return nil, err
	}

	store, err := s.getOrCreateStore(ctx, s.tenantID)
	if err != nil {
		return nil, err
	}

	s.storeID = store.GetId()

	modelID, err := s.loadModel(ctx, s.storeID, s.modules)
	if err != nil {
		return nil, err
	}

	s.modelID = modelID

	return s, nil
}
