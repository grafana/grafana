package app

import "time"

// defaultGCGracePeriod is how long a lease must stay expired before the garbage
// collector deletes it. It is orders of magnitude above the 600s duration cap, so
// GC only ever touches leases that have been dead for hours.
const defaultGCGracePeriod = 24 * time.Hour

// CoordinationConfig is the app-specific configuration for the coordination app.
type CoordinationConfig struct {
	// EnableGarbageCollector runs the lease GC reconciler, which watches Leases and
	// ClusterLeases and deletes those whose expiry lies more than GracePeriod in the past.
	EnableGarbageCollector bool
	// GracePeriod overrides the default grace period before an expired lease is
	// collected. Zero uses defaultGCGracePeriod.
	GracePeriod time.Duration
}
