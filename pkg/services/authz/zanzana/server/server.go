package server

import (
	"context"
	"errors"
	"fmt"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/transformer"
	"go.opentelemetry.io/otel"
	"google.golang.org/protobuf/types/known/wrapperspb"

	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

const (
	resourceType     = "resource"
	namespaceType    = "namespace"
	folderTypePrefix = "folder:"
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

func (s *Server) getOrCreateStore(ctx context.Context, name string) (*openfgav1.Store, error) {
	store, err := s.getStore(ctx, name)

	if errors.Is(err, errStoreNotFound) {
		var res *openfgav1.CreateStoreResponse
		res, err = s.openfga.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: name})
		if res != nil {
			store = &openfgav1.Store{
				Id:        res.GetId(),
				Name:      res.GetName(),
				CreatedAt: res.GetCreatedAt(),
			}
		}
	}

	return store, err
}

func (s *Server) getStore(ctx context.Context, name string) (*openfgav1.Store, error) {
	var continuationToken string

	// OpenFGA client does not support any filters for stores.
	// We should create an issue to support some way to get stores by name.
	// For now we need to go thourh all stores until we find a match or we hit the end.
	for {
		res, err := s.openfga.ListStores(ctx, &openfgav1.ListStoresRequest{
			PageSize:          &wrapperspb.Int32Value{Value: 20},
			ContinuationToken: continuationToken,
		})

		if err != nil {
			return nil, fmt.Errorf("failed to initiate zanzana tenant: %w", err)
		}

		for _, s := range res.GetStores() {
			if s.GetName() == name {
				return s, nil
			}
		}

		// we have no more stores to check
		if res.GetContinuationToken() == "" {
			return nil, errStoreNotFound
		}

		continuationToken = res.GetContinuationToken()
	}
}

func (s *Server) loadModel(ctx context.Context, storeID string, modules []transformer.ModuleFile) (string, error) {
	var continuationToken string

	model, err := schema.TransformModulesToModel(modules)
	if err != nil {
		return "", err
	}

	for {
		// ReadAuthorizationModels returns authorization models for a store sorted in descending order of creation.
		// So with a pageSize of 1 we will get the latest model.
		res, err := s.openfga.ReadAuthorizationModels(ctx, &openfgav1.ReadAuthorizationModelsRequest{
			StoreId:           storeID,
			PageSize:          &wrapperspb.Int32Value{Value: 20},
			ContinuationToken: continuationToken,
		})

		if err != nil {
			return "", fmt.Errorf("failed to load authorization model: %w", err)
		}

		for _, m := range res.GetAuthorizationModels() {
			// If provided dsl is equal to a stored dsl we use that as the authorization id
			if schema.EqualModels(m, model) {
				return m.GetId(), nil
			}
		}

		// If we have not found any matching authorization model we break the loop and create a new one
		if res.GetContinuationToken() == "" {
			break
		}

		continuationToken = res.GetContinuationToken()
	}

	writeRes, err := s.openfga.WriteAuthorizationModel(ctx, &openfgav1.WriteAuthorizationModelRequest{
		StoreId:         s.storeID,
		TypeDefinitions: model.GetTypeDefinitions(),
		SchemaVersion:   model.GetSchemaVersion(),
		Conditions:      model.GetConditions(),
	})

	if err != nil {
		return "", fmt.Errorf("failed to load authorization model: %w", err)
	}

	return writeRes.GetAuthorizationModelId(), nil
}
