package zanzana

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
	"github.com/grafana/grafana/pkg/setting"
)

// Client is a wrapper around [openfgav1.OpenFGAServiceClient]
type Client interface {
	authz.AccessClient
	List(ctx context.Context, id claims.AuthInfo, req authz.ListRequest) (*authzextv1.ListResponse, error)

	Read(ctx context.Context, in *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error)
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
