package cache

import (
	"context"
	"net/http"
	"time"
)

// MetricsProvider defines the interface for fetching available metrics
// from any datasource type (Prometheus, Loki, Mimir, etc.).
// Each datasource type implements its own provider.
type MetricsProvider interface {
	// GetMetrics fetches available metric names from the datasource.
	// Returns the metrics list and recommended TTL for caching.
	// The client parameter should have proper authentication configured.
	GetMetrics(ctx context.Context, datasourceUID, datasourceURL string,
		client *http.Client) (*MetricsResult, error)
}

// MetricsResult contains fetched metrics and recommended TTL for caching.
type MetricsResult struct {
	Metrics []string
	TTL     time.Duration
}
