package object

import (
	context "context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/setting"
	grpc "google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Service struct {
	*services.BasicService
	ObjectStoreClient
}

func ProvideService(cfg *setting.Cfg) *Service {
	s := &Service{}
	s.BasicService = services.NewBasicService(nil, s.run, nil)
	conn, err := grpc.Dial(cfg.ObjectStore.Address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil
	}
	s.ObjectStoreClient = NewObjectStoreClient(conn)
	return s
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
