package nats

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"slices"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// peerRecord is a single embedded-NATS cluster peer advertisement stored in
// the DB-backed peer registry. It is operational membership metadata, not
// message state.
type peerRecord struct {
	NodeID    string    `json:"nodeID"`
	RouteURL  string    `json:"routeURL"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (s *Service) discoveryLoop(ctx context.Context, routeURL string) {
	ticker := time.NewTicker(s.cfg.DiscoveryInterval)
	defer ticker.Stop()

	s.refreshDiscovery(ctx, routeURL)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.refreshDiscovery(ctx, routeURL)
		}
	}
}

func (s *Service) refreshDiscovery(ctx context.Context, routeURL string) {
	if err := s.register(ctx, routeURL); err != nil {
		s.log.Warn("failed to register nats peer", "err", err)
		return
	}

	routes, err := s.discoverRoutes(ctx, routeURL)
	if err != nil {
		s.log.Warn("failed to discover nats peers", "err", err)
		return
	}
	s.updateRoutes(routes)

	if err := s.cleanupStalePeers(ctx); err != nil {
		s.log.Warn("failed to cleanup stale nats peers", "err", err)
	}
}

func (s *Service) register(ctx context.Context, routeURL string) error {
	rec := peerRecord{
		NodeID:    s.nodeID(),
		RouteURL:  routeURL,
		UpdatedAt: time.Now().UTC(),
	}
	data, err := json.Marshal(rec)
	if err != nil {
		return err
	}

	w, err := s.kv.Save(ctx, kv.NATSPeersSection, rec.NodeID)
	if err != nil {
		return err
	}
	if _, err := w.Write(data); err != nil {
		_ = w.Close()
		return err
	}
	return w.Close()
}

func (s *Service) unregister(ctx context.Context) error {
	return s.kv.Delete(ctx, kv.NATSPeersSection, s.nodeID())
}

func (s *Service) discoverRoutes(ctx context.Context, selfRouteURL string) ([]*url.URL, error) {
	if s.kv == nil {
		return nil, nil
	}
	now := time.Now()
	var routes []string
	for key, err := range s.kv.Keys(ctx, kv.NATSPeersSection, kv.ListOptions{Sort: kv.SortOrderAsc}) {
		if err != nil {
			return nil, err
		}
		rec, err := s.readPeer(ctx, key)
		if err != nil {
			if errors.Is(err, kv.ErrNotFound) {
				continue
			}
			return nil, err
		}
		if rec.RouteURL == "" || rec.RouteURL == selfRouteURL || now.Sub(rec.UpdatedAt) > s.cfg.DiscoveryTTL {
			continue
		}
		if !slices.Contains(routes, rec.RouteURL) {
			routes = append(routes, rec.RouteURL)
		}
	}
	return parseRouteURLs(routes), nil
}

func (s *Service) cleanupStalePeers(ctx context.Context) error {
	now := time.Now()
	for key, err := range s.kv.Keys(ctx, kv.NATSPeersSection, kv.ListOptions{Sort: kv.SortOrderAsc}) {
		if err != nil {
			return err
		}
		rec, err := s.readPeer(ctx, key)
		if err != nil {
			if errors.Is(err, kv.ErrNotFound) {
				continue
			}
			return err
		}
		if now.Sub(rec.UpdatedAt) > s.cfg.DiscoveryTTL {
			if err := s.kv.Delete(ctx, kv.NATSPeersSection, key); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) readPeer(ctx context.Context, key string) (peerRecord, error) {
	r, err := s.kv.Get(ctx, kv.NATSPeersSection, key)
	if err != nil {
		return peerRecord{}, err
	}
	defer func() { _ = r.Close() }()

	data, err := io.ReadAll(r)
	if err != nil {
		return peerRecord{}, err
	}

	var rec peerRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return peerRecord{}, fmt.Errorf("decode nats peer %q: %w", key, err)
	}
	return rec, nil
}

func (s *Service) updateRoutes(routes []*url.URL) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.server == nil || s.opts == nil {
		return
	}

	next := *s.opts
	next.Routes = routes
	if err := s.server.ReloadOptions(&next); err != nil {
		s.log.Warn("failed to reload nats routes", "err", err)
		return
	}
	s.opts = &next
}

func (s *Service) nodeID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.opts != nil && s.opts.ServerName != "" {
		return s.opts.ServerName
	}
	return defaultServerNamePrefix + "unknown"
}
