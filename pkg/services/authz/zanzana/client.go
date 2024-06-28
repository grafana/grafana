package zanzana

import (
	"context"
	"fmt"

	"google.golang.org/grpc"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	"github.com/grafana/grafana/pkg/setting"
)

// Client is a wrapper around [openfgav1.OpenFGAServiceClient]
type Client interface {
	Check(ctx context.Context, in *openfgav1.CheckRequest, opts ...grpc.CallOption) (*openfgav1.CheckResponse, error)
	ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest, opts ...grpc.CallOption) (*openfgav1.ListObjectsResponse, error)
}

func NewClient(ctx context.Context, cc grpc.ClientConnInterface, cfg *setting.Cfg) (*client.Client, error) {
	return client.New(
		ctx,
		cc,
		client.WithTenantID(fmt.Sprintf("stack-%s", cfg.StackID)),
		client.WithLogger(log.New("zanzana-client")),
	)
}
