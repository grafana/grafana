package lokihttp

import (
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/flagext"
	"github.com/prometheus/common/config"
)

// Config describes configuration for a HTTP pusher client.
type Config struct {
	URL       flagext.URLValue
	BatchWait time.Duration
	BatchSize int

	Client config.HTTPClientConfig

	BackoffConfig backoff.Config
	Timeout       time.Duration

	TenantID string
}
