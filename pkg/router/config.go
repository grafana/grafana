package router

import (
	"crypto/tls"
	"log/slog"
	"time"
)

// GrafanaRouterConfig configures the standalone cloud-apps router process: its
// listen socket, TLS, and graceful-shutdown behavior.
type GrafanaRouterConfig struct {
	// Addr is the listen address, e.g. ":6444". Required.
	Addr string

	// TLSConfig terminates TLS on the listen port. If nil the server listens in
	// plaintext, which is only safe when something upstream (service mesh,
	// aggregator) has already authenticated the caller — see the security note
	// on GrafanaRouter.
	TLSConfig *tls.Config

	// ShutdownTimeout bounds graceful drain on shutdown. Defaults to 10s.
	ShutdownTimeout time.Duration

	// ReadHeaderTimeout bounds how long a client may take to send request
	// headers. Defaults to 15s. It is the one timeout safe to enforce on a
	// reverse proxy (it does not cap streaming bodies) and it closes the
	// slow-header (Slowloris) hole.
	ReadHeaderTimeout time.Duration

	// Logger is used for lifecycle logging. Defaults to slog.Default().
	Logger *slog.Logger
}
