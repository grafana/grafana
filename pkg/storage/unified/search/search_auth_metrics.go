package search

import (
	"context"
	"sync/atomic"
	"time"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type searchAuthObservationKey struct{}

// A federated PreRank search can authorize several indexes concurrently.
// Accumulate locally and update histograms once per executed search.
type searchAuthObservation struct {
	metrics *resource.SearchAuthMetrics
	checks  atomic.Int64
}

func newSearchAuthObservation(metrics *resource.BleveIndexMetrics) *searchAuthObservation {
	if metrics == nil || metrics.SearchAuth == nil {
		return nil
	}
	return &searchAuthObservation{metrics: metrics.SearchAuth}
}

func searchAuthObservationFromContext(ctx context.Context) *searchAuthObservation {
	observation, _ := ctx.Value(searchAuthObservationKey{}).(*searchAuthObservation)
	return observation
}

func (o *searchAuthObservation) event(reason string) {
	if o != nil {
		o.metrics.Events.WithLabelValues(reason).Inc()
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
		returned := 0
		if result.Results != nil {
			returned = len(result.Results.Rows)
		}
		o.metrics.Returned.WithLabelValues(mode, queryType).Observe(float64(returned))
	}
	o.metrics.Duration.WithLabelValues(mode, queryType, outcome).Observe(time.Since(started).Seconds())
	o.metrics.Checks.WithLabelValues(mode, queryType).Observe(float64(o.checks.Load()))
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
