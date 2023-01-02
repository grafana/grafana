package lokigrpc

import "time"

// Config describes configuration for a gRPC pusher client.
type Config struct {
	URL string

	Retries uint
	Timeout time.Duration

	TLSEnabled bool

	TenantID string
}
