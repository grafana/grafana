package client

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
)

type ShadowClient struct {
	logger        log.Logger
	accessClient  authlib.AccessClient
	zanzanaClient authlib.AccessClient
	metrics       *metrics
}

// WithShadowClient returns a new access client that runs zanzana checks in the background.
func WithShadowClient(accessClient authlib.AccessClient, zanzanaClient authlib.AccessClient, reg prometheus.Registerer) authlib.AccessClient {
	client := &ShadowClient{
		logger:        log.New("zanzana-shadow-client"),
		accessClient:  accessClient,
		zanzanaClient: zanzanaClient,
		metrics:       newShadowClientMetrics(reg),
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

		timer := prometheus.NewTimer(c.metrics.evaluationsSeconds.WithLabelValues("zanzana"))
		defer timer.ObserveDuration()

		zanzanaCtx := context.WithoutCancel(ctx)
		res, err := c.zanzanaClient.Check(zanzanaCtx, id, req)
		if err != nil {
			c.logger.Error("Failed to run zanzana check", "error", err)
		}

		acRes := <-acResChan
		acErr := <-acErrChan

		if acErr == nil {
			if res.Allowed != acRes.Allowed {
				c.metrics.evaluationStatusTotal.WithLabelValues("error").Inc()
				c.logger.Warn("Zanzana check result does not match", "expected", acRes.Allowed, "actual", res.Allowed, "user", id.GetUID(), "request", req)
			} else {
				c.metrics.evaluationStatusTotal.WithLabelValues("success").Inc()
			}
		}
	}()

	timer := prometheus.NewTimer(c.metrics.evaluationsSeconds.WithLabelValues("rbac"))
	res, err := c.accessClient.Check(ctx, id, req)
	timer.ObserveDuration()
	acResChan <- res
	acErrChan <- err

	return res, err
}

func (c *ShadowClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, error) {
	zanzanaItemCheckerChan := make(chan authlib.ItemChecker, 1)
	go func() {
		if c.zanzanaClient == nil {
			zanzanaItemCheckerChan <- nil
			return
		}

		timer := prometheus.NewTimer(c.metrics.compileSeconds.WithLabelValues("zanzana"))
		itemChecker, err := c.zanzanaClient.Compile(ctx, id, req)
		timer.ObserveDuration()
		if err != nil {
			c.logger.Warn("Failed to compile zanzana item checker", "error", err)
		}
		zanzanaItemCheckerChan <- itemChecker
	}()

	timer := prometheus.NewTimer(c.metrics.compileSeconds.WithLabelValues("rbac"))
	rbacItemChecker, err := c.accessClient.Compile(ctx, id, req)
	timer.ObserveDuration()
	if err != nil {
		return nil, err
	}

	zanzanaItemChecker := <-zanzanaItemCheckerChan

	shadowItemChecker := func(name, folder string) bool {
		rbacRes := rbacItemChecker(name, folder)
		if zanzanaItemChecker != nil {
			zanzanaRes := zanzanaItemChecker(name, folder)
			if zanzanaRes != rbacRes {
				c.metrics.evaluationStatusTotal.WithLabelValues("error").Inc()
				c.logger.Warn("Zanzana compile result does not match", "expected", rbacRes, "actual", zanzanaRes, "name", name, "folder", folder)
			} else {
				c.metrics.evaluationStatusTotal.WithLabelValues("success").Inc()
			}
		}
		return rbacRes
	}

	return shadowItemChecker, err
}
