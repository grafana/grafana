package prometheus

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/cache"
)

// fetcherLike defines minimal interface for the Fetcher (used for testing)
type fetcherLike interface {
	FetchMetrics(ctx context.Context, datasourceURL string, client *http.Client) ([]string, error)
}

// PrometheusProvider implements cache.MetricsProvider for Prometheus datasources.
// It wraps the existing Fetcher and returns results with a configurable TTL.
type PrometheusProvider struct {
	fetcher fetcherLike
	ttl     time.Duration
}

// NewPrometheusProvider creates a new PrometheusProvider with the given TTL.
func NewPrometheusProvider(ttl time.Duration) *PrometheusProvider {
	return &PrometheusProvider{
		fetcher: NewFetcher(),
		ttl:     ttl,
	}
}

// GetMetrics implements cache.MetricsProvider.
// It fetches available metrics from Prometheus and returns them with the provider's TTL.
func (p *PrometheusProvider) GetMetrics(ctx context.Context, datasourceUID, datasourceURL string,
	client *http.Client) (*cache.MetricsResult, error) {
	metrics, err := p.fetcher.FetchMetrics(ctx, datasourceURL, client)
	if err != nil {
		return nil, err
	}

	return &cache.MetricsResult{
		Metrics: metrics,
		TTL:     p.ttl,
	}, nil
}
