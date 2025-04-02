package client

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
)

type ShadowClient struct {
	logger        log.Logger
	accessClient  authlib.AccessClient
	zanzanaClient authlib.AccessClient
}

// WithShadowClient returns a new access client that runs zanzana checks in the background.
func WithShadowClient(accessClient authlib.AccessClient, zanzanaClient authlib.AccessClient) authlib.AccessClient {
	client := &ShadowClient{
		logger:        log.New("zanzana-shadow-client"),
		accessClient:  accessClient,
		zanzanaClient: zanzanaClient,
	}
	return client
}

func (c *ShadowClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error) {
	acResChan := make(chan authlib.CheckResponse, 1)
	acErrChan := make(chan error, 1)

	go func() {
		if c.zanzanaClient == nil {
			return
		}

		zanzanaCtx := context.WithoutCancel(ctx)
		res, err := c.zanzanaClient.Check(zanzanaCtx, id, req)
		if err != nil {
			c.logger.Error("Failed to run zanzana check", "error", err)
		}

		acRes := <-acResChan
		acErr := <-acErrChan

		if acErr == nil {
			if res.Allowed != acRes.Allowed {
				c.logger.Warn("Zanzana check result does not match", "expected", acRes.Allowed, "actual", res.Allowed)
			} else {
				c.logger.Debug("Zanzana check result is correct", "result", res.Allowed)
			}
		}
	}()

	res, err := c.accessClient.Check(ctx, id, req)
	acResChan <- res
	acErrChan <- err

	return res, err
}

func (c *ShadowClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, error) {
	return c.accessClient.Compile(ctx, id, req)
}
