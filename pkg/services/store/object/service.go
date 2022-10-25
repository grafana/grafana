package object

import (
	context "context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/setting"
	grpc "google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Service struct {
	*services.BasicService
	ObjectStoreClient
	cfg               *setting.Cfg
	pluginAuthService jwt.PluginAuthService
}

func ProvideObjectStoreService(cfg *setting.Cfg, pluginAuthService jwt.PluginAuthService) *Service {
	s := &Service{cfg: cfg, pluginAuthService: pluginAuthService}
	s.BasicService = services.NewBasicService(nil, s.run, nil)
	return s
}

func (s *Service) start(ctx context.Context) error {
	conn, err := grpc.Dial(
		s.cfg.ObjectStore.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithChainUnaryInterceptor(s.pluginAuthService.UnaryClientInterceptor("object-store")),
		grpc.WithChainStreamInterceptor(s.pluginAuthService.StreamClientInterceptor("object-store")),
	)
	if err != nil {
		return err
	}
	s.ObjectStoreClient = NewObjectStoreClient(conn)
	return nil
}

func (s *Service) run(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		}
	}
}

func (s *Service) Write(ctx context.Context, req *WriteObjectRequest) (*WriteObjectResponse, error) {
	return s.ObjectStoreClient.Write(ctx, req)
}

func (s *Service) Read(ctx context.Context, req *ReadObjectRequest) (*ReadObjectResponse, error) {
	return s.ObjectStoreClient.Read(ctx, req)
}

func (s *Service) BatchRead(ctx context.Context, req *BatchReadObjectRequest) (*BatchReadObjectResponse, error) {
	return s.ObjectStoreClient.BatchRead(ctx, req)
}

func (s *Service) Delete(ctx context.Context, req *DeleteObjectRequest) (*DeleteObjectResponse, error) {
	return s.ObjectStoreClient.Delete(ctx, req)
}

func (s *Service) History(ctx context.Context, req *ObjectHistoryRequest) (*ObjectHistoryResponse, error) {
	return s.ObjectStoreClient.History(ctx, req)
}

func (s *Service) Search(ctx context.Context, req *ObjectSearchRequest) (*ObjectSearchResponse, error) {
	return s.ObjectStoreClient.Search(ctx, req)
}
