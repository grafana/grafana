package grafana

import (
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type simpleCacheItem struct {
	init time.Time
	dr   *backend.DataResponse
}

type simpleCache struct {
	TTL     time.Duration
	items   map[string]simpleCacheItem
	itemsMu sync.RWMutex
}

func (g *simpleCache) getItem(path string) *backend.DataResponse {
	g.itemsMu.RLock()
	v, ok := g.items[path]
	g.itemsMu.RUnlock() // defer? but then you can't lock further down
	if !ok || time.Since(v.init) > g.TTL {
		return nil
	}
	return v.dr
}

func (g *simpleCache) setItem(path string, dr *backend.DataResponse) {
	g.itemsMu.Lock()
	g.items[path] = simpleCacheItem{
		init: time.Now(),
		dr:   dr,
	}
	g.itemsMu.Unlock()
}
