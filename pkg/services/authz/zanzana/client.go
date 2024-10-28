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
	CheckObject(ctx context.Context, in *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error)
	Read(ctx context.Context, in *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error)
	ListObjects(ctx context.Context, in *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error)
	Write(ctx context.Context, in *openfgav1.WriteRequest) error
}

func NewClient(ctx context.Context, cc grpc.ClientConnInterface, cfg *setting.Cfg) (*client.Client, error) {
	stackID := cfg.StackID
	if stackID == "" {
		stackID = "default"
	}

	return client.New(
		ctx,
		cc,
		client.WithTenantID(fmt.Sprintf("stacks-%s", stackID)),
		client.WithLogger(log.New("zanzana-client")),
	)
}

func NewNoopClient() *client.NoopClient {
	return client.NewNoop()
}
