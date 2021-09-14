package notifier

import (
	"time"

	"github.com/prometheus/alertmanager/cluster"
)

// These constants are used and set via the settings package.
const (
	DefaultClusterAddr      = "0.0.0.0:9094"
	DefaultPeerTimeout      = 15 * time.Second
	DefaultGossipInterval   = cluster.DefaultGossipInterval
	DefaultPushPullInterval = cluster.DefaultPushPullInterval
)
