package client

import (
	"context"
	"sync"

	"github.com/prometheus/client_golang/prometheus"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
)

var _ authlib.AccessClient = (*ShadowRBACClient)(nil)

type ShadowRBACClient struct {
	logger        log.Logger
	accessClient  authlib.AccessClient
	zanzanaClient authlib.AccessClient
	metrics       *shadowClientMetrics
}

// WithShadowRBACClient returns a new access client that runs legacy RBAC checks in the background.
// Zanzana is the primary client whose results are returned; RBAC is used only for comparison.
func WithShadowRBACClient(zanzanaClient authlib.AccessClient, accessClient authlib.AccessClient, reg prometheus.Registerer) (authlib.AccessClient, error) {
	client := &ShadowRBACClient{
		logger:        log.New("zanzana-shadow-rbac-client"),
		accessClient:  accessClient,
		zanzanaClient: zanzanaClient,
		metrics:       newShadowClientMetrics(reg),
	}
	return client, nil
}

func (c *ShadowRBACClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	zanzanaResChan := make(chan authlib.CheckResponse, 1)
	zanzanaErrChan := make(chan error, 1)

	go func() {
		if c.accessClient == nil {
			return
		}

		rbacCtx := context.WithoutCancel(ctx)
		rbacCtxTimeout, cancel := context.WithTimeout(rbacCtx, zanzanaTimeout)
		defer cancel()

		timer := prometheus.NewTimer(c.metrics.evaluationsSeconds.WithLabelValues("rbac"))
		res, err := c.accessClient.Check(rbacCtxTimeout, id, req, folder)
		if err != nil {
			c.logger.Error("Failed to run rbac check", "error", err)
		}
		timer.ObserveDuration()

		zanzanaRes := <-zanzanaResChan
		zanzanaErr := <-zanzanaErrChan

		if zanzanaErr == nil {
			if res.Allowed != zanzanaRes.Allowed {
				c.metrics.evaluationStatusTotal.WithLabelValues("error", "check", formatCheck(req), req.Namespace).Inc()
				c.logger.Warn("RBAC check result does not match zanzana", "expected", zanzanaRes.Allowed, "actual", res.Allowed, "user", id.GetUID(), "request", req)
			} else {
				c.metrics.evaluationStatusTotal.WithLabelValues("success", "check", formatCheck(req), req.Namespace).Inc()
			}
		}
	}()

	timer := prometheus.NewTimer(c.metrics.evaluationsSeconds.WithLabelValues("zanzana"))
	res, err := c.zanzanaClient.Check(ctx, id, req, folder)
	timer.ObserveDuration()
	zanzanaResChan <- res
	zanzanaErrChan <- err

	return res, err
}

func (c *ShadowRBACClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	rbacItemCheckerChan := make(chan authlib.ItemChecker, 1)
	var rbacItemChecker authlib.ItemChecker
	var once sync.Once

	go func() {
		if c.accessClient == nil {
			rbacItemCheckerChan <- nil
			return
		}

		rbacCtx := context.WithoutCancel(ctx)
		rbacCtxTimeout, cancel := context.WithTimeout(rbacCtx, zanzanaTimeout)
		defer cancel()

		timer := prometheus.NewTimer(c.metrics.compileSeconds.WithLabelValues("rbac"))
		//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
		itemChecker, _, err := c.accessClient.Compile(rbacCtxTimeout, id, req) //nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
		timer.ObserveDuration()
		if err != nil {
			c.logger.Warn("Failed to compile rbac item checker", "error", err)
		}
		rbacItemCheckerChan <- itemChecker
	}()

	timer := prometheus.NewTimer(c.metrics.compileSeconds.WithLabelValues("zanzana"))
	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	zanzanaItemChecker, _, err := c.zanzanaClient.Compile(ctx, id, req) //nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	timer.ObserveDuration()
	if err != nil {
		return nil, authlib.NoopZookie{}, err
	}

	shadowItemChecker := func(name, folder string) bool {
		zanzanaRes := zanzanaItemChecker(name, folder)

		go func() {
			// Wait for the rbac checker to be ready and then use it to compare against zanzana
			once.Do(func() {
				rbacItemChecker = <-rbacItemCheckerChan
			})

			if rbacItemChecker != nil {
				rbacRes := rbacItemChecker(name, folder)
				if rbacRes != zanzanaRes {
					c.metrics.evaluationStatusTotal.WithLabelValues("error", "compile", "other", req.Namespace).Inc()
					c.logger.Warn("RBAC compile result does not match zanzana", "expected", zanzanaRes, "actual", rbacRes, "name", name, "folder", folder)
				} else {
					c.metrics.evaluationStatusTotal.WithLabelValues("success", "compile", "other", req.Namespace).Inc()
				}
			}
		}()

		return zanzanaRes
	}

	return shadowItemChecker, authlib.NoopZookie{}, err
}

func (c *ShadowRBACClient) BatchCheck(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	zanzanaResChan := make(chan authlib.BatchCheckResponse, 1)
	zanzanaErrChan := make(chan error, 1)

	go func() {
		if c.accessClient == nil {
			return
		}

		rbacCtx := context.WithoutCancel(ctx)
		rbacCtxTimeout, cancel := context.WithTimeout(rbacCtx, zanzanaTimeout)
		defer cancel()

		timer := prometheus.NewTimer(c.metrics.batchCheckSeconds.WithLabelValues("rbac"))
		res, err := c.accessClient.BatchCheck(rbacCtxTimeout, id, req)
		if err != nil {
			c.logger.Error("Failed to run rbac batch check", "error", err)
		}
		timer.ObserveDuration()

		zanzanaRes := <-zanzanaResChan
		zanzanaErr := <-zanzanaErrChan

		if zanzanaErr == nil {
			c.compareRBACBatchCheckResults(zanzanaRes, res, id, req)
		}
	}()

	timer := prometheus.NewTimer(c.metrics.batchCheckSeconds.WithLabelValues("zanzana"))
	res, err := c.zanzanaClient.BatchCheck(ctx, id, req)
	timer.ObserveDuration()
	zanzanaResChan <- res
	zanzanaErrChan <- err

	return res, err
}

// compareRBACBatchCheckResults compares the results from zanzana and RBAC batch checks
// and logs any discrepancies.
func (c *ShadowRBACClient) compareRBACBatchCheckResults(zanzanaRes, rbacRes authlib.BatchCheckResponse, id authlib.AuthInfo, req authlib.BatchCheckRequest) {
	checkItems := make(map[string]authlib.BatchCheckItem, len(req.Checks))
	for _, checkItem := range req.Checks {
		checkItems[checkItem.CorrelationID] = checkItem
	}

	for correlationID, zanzanaResult := range zanzanaRes.Results {
		rbacResult, ok := rbacRes.Results[correlationID]
		checkItem := checkItems[correlationID]

		if !ok {
			c.metrics.evaluationStatusTotal.WithLabelValues("error", "batch_check", formatBatchCheck(checkItem), req.Namespace).Inc()
			c.logger.Warn("RBAC batch check missing result", "item", checkItem, "user", id.GetUID(), "req_namespace", req.Namespace)
			continue
		}

		if zanzanaResult.Allowed != rbacResult.Allowed {
			c.metrics.evaluationStatusTotal.WithLabelValues("error", "batch_check", formatBatchCheck(checkItem), req.Namespace).Inc()
			c.logger.Warn("RBAC batch check result does not match zanzana", "expected", zanzanaResult.Allowed, "actual", rbacResult.Allowed, "item", checkItem, "user", id.GetUID(), "req_namespace", req.Namespace)
		} else {
			c.metrics.evaluationStatusTotal.WithLabelValues("success", "batch_check", formatBatchCheck(checkItem), req.Namespace).Inc()
		}
	}
}
