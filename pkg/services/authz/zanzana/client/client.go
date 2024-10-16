package client

import (
	"context"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var _ zanzana.ZanzanaClient = (*ZanzanaClient)(nil)

type ZanzanaClient struct {
	logger        log.Logger
	openfgaClient zanzana.OpenFGAClient
}

func NewZanzanaClient(openfgaClient zanzana.OpenFGAClient) (*ZanzanaClient, error) {
	client := &ZanzanaClient{
		logger:        log.New("zanzana"),
		openfgaClient: openfgaClient,
	}

	return client, nil
}

func (c *ZanzanaClient) Check(ctx context.Context, caller claims.AuthInfo, req *authzlib.CheckRequest) (authzlib.CheckResponse, error) {
	return authzlib.CheckResponse{}, nil
}

func (c *ZanzanaClient) List(ctx context.Context, caller claims.AuthInfo, req *zanzana.ListRequest) ([]string, error) {
	return []string{}, nil
}
