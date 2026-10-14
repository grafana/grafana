package search

import (
	"context"
	"sync/atomic"
	"time"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// A federated PreRank search can authorize several indexes concurrently.
// Accumulate locally and update histograms once per executed search.
type searchAuthObservation struct {
	metrics *resource.BleveIndexMetrics
	checks  atomic.Int64
}

func withSearchAuthObservation(access authlib.AccessClient, metrics *resource.BleveIndexMetrics) (authlib.AccessClient, *searchAuthObservation) {
	observation := &searchAuthObservation{metrics: metrics}
	if access != nil {
		access = &observedSearchAccessClient{AccessClient: access, observation: observation}
	}
	return access, observation
}

func (o *searchAuthObservation) start(req *resourcepb.ResourceSearchRequest, access authlib.AccessClient, postRank, cursorFallback bool) func(*resourcepb.ResourceSearchResponse, error) {
	mode := "pre_rank"
	if access == nil {
		mode = "none"
	} else if postRank {
		mode = "post_rank"
	}
	if cursorFallback {
		o.metrics.SearchAuthEvents.WithLabelValues("cursor_fallback").Inc()
	}
	started := time.Now()
	return func(result *resourcepb.ResourceSearchResponse, err error) {
		o.observe(mode, searchAuthQueryType(req), started, result, err)
	}
}

func searchAuthQueryType(req *resourcepb.ResourceSearchRequest) string {
	if req.IsDeleted {
		return "trash"
	}
	if len(req.Facet) > 0 {
		return "facets"
	}
	if req.Limit == 0 {
		return "count"
	}
	return "page"
}

func (o *searchAuthObservation) observe(mode, queryType string, started time.Time, result *resourcepb.ResourceSearchResponse, err error) {
	outcome := "success"
	if err != nil || result == nil || result.Error != nil {
		outcome = "error"
	} else {
		returned := len(result.Rows)
		if result.Results != nil {
			returned = len(result.Results.Rows)
		}
		o.metrics.SearchAuthReturned.WithLabelValues(mode, queryType).Observe(float64(returned))
	}
	o.metrics.SearchAuthDuration.WithLabelValues(mode, queryType, outcome).Observe(time.Since(started).Seconds())
	o.metrics.SearchAuthChecks.WithLabelValues(mode, queryType).Observe(float64(o.checks.Load()))
}

type observedSearchAccessClient struct {
	authlib.AccessClient
	observation *searchAuthObservation
}

func (c *observedSearchAccessClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	c.observation.checks.Add(1)
	return c.AccessClient.Check(ctx, id, req, folder)
}

func (c *observedSearchAccessClient) BatchCheck(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	c.observation.checks.Add(int64(len(req.Checks)))
	return c.AccessClient.BatchCheck(ctx, id, req)
}
