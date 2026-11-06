package nats

import (
	"crypto/tls"
	"fmt"
	"net/url"

	natsserver "github.com/nats-io/nats-server/v2/server"
)

// setRoutes replaces the solicited cluster routes. nats-server only presents
// the credentials carried in a solicited route's URL.
func (s *Server) setRoutes(routes []*url.URL) error {
	s.mu.RLock()
	creds := s.routeAuth
	s.mu.RUnlock()
	routes = withRouteCredentials(routes, creds)
	return s.reload(func(o *natsserver.Options) { o.Routes = routes })
}

// setClusterTLS replaces the route TLS config. New route connections use it;
// established routes keep their TLS session.
func (s *Server) setClusterTLS(tc *tls.Config) error {
	return s.reload(func(o *natsserver.Options) { o.Cluster.TLSConfig = tc })
}

// reload applies change on top of the last applied options. Discovery and the
// certificate watcher both reload, so each must keep the other's latest change.
func (s *Server) reload(change func(*natsserver.Options)) error {
	s.reloadMu.Lock()
	defer s.reloadMu.Unlock()

	s.mu.RLock()
	server := s.server
	next := *s.opts
	s.mu.RUnlock()
	if server == nil {
		return fmt.Errorf("embedded nats server is not running")
	}

	change(&next)
	// ReloadOptions mutates what it is given; keep the unmodified copy as the
	// base for the next reload.
	applied := next
	if err := server.ReloadOptions(&next); err != nil {
		return err
	}

	s.mu.Lock()
	s.opts = &applied
	s.mu.Unlock()
	return nil
}
