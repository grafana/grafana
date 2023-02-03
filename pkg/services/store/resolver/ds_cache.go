package resolver

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/tsdb/grafanads"
)

type dsVal struct {
	InternalID   int64
	IsDefault    bool
	Name         string
	Type         string
	UID          string
	PluginExists bool // type exists
}

type dsCache struct {
	ds          datasources.DataSourceService
	pluginStore plugins.Store
	cache       map[int64]map[string]*dsVal
	timestamp   time.Time // across all orgIDs
	mu          sync.Mutex
}

func (c *dsCache) refreshCache(ctx context.Context) error {
	old := c.timestamp

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.timestamp != old {
		return nil // already updated while we waited!
	}

	cache := make(map[int64]map[string]*dsVal, 0)
	defaultDS := make(map[int64]*dsVal, 0)

	q := &datasources.GetAllDataSourcesQuery{}
	err := c.ds.GetAllDataSources(ctx, q)
	if err != nil {
		return err
	}

	for _, ds := range q.Result {
		val := &dsVal{
			InternalID: ds.ID,
			Name:       ds.Name,
			UID:        ds.UID,
			Type:       ds.Type,
			IsDefault:  ds.IsDefault,
		}
		_, ok := c.pluginStore.Plugin(ctx, val.Type)
		val.PluginExists = ok

		orgCache, ok := cache[ds.OrgID]
		if !ok {
			orgCache = make(map[string]*dsVal, 0)
			cache[ds.OrgID] = orgCache
		}

		orgCache[val.UID] = val

		// Empty string or
		if val.IsDefault {
			defaultDS[ds.OrgID] = val
		}
	}

	for orgID, orgDSCache := range cache {
		// modifies the cache we are iterating over?
		for _, ds := range orgDSCache {
			// Lookup by internal ID
			id := fmt.Sprintf("%d", ds.InternalID)
			_, ok := orgDSCache[id]
			if !ok {
				orgDSCache[id] = ds
			}

			// Lookup by name
			_, ok = orgDSCache[ds.Name]
			if !ok {
				orgDSCache[ds.Name] = ds
			}
		}

		// Register the internal builtin grafana datasource
		gds := &dsVal{
			Name:         grafanads.DatasourceName,
			UID:          grafanads.DatasourceUID,
			Type:         grafanads.DatasourceUID,
			PluginExists: true,
		}
		orgDSCache[gds.UID] = gds
		ds, ok := defaultDS[orgID]
		if !ok {
			ds = gds // use the internal grafana datasource
		}
		orgDSCache[""] = ds
		if orgDSCache["default"] == nil {
			orgDSCache["default"] = ds
		}
	}

	c.cache = cache
	c.timestamp = getNow()
	return nil
}

func (c *dsCache) getDS(ctx context.Context, uid string) (*dsVal, error) {
	// refresh cache every 1 min
	if c.cache == nil || c.timestamp.Before(getNow().Add(time.Minute*-1)) {
		err := c.refreshCache(ctx)
		if err != nil {
			return nil, err
		}
	}

	usr, err := appcontext.User(ctx)
	if err != nil {
		return nil, nil // no user
	}

	v, ok := c.cache[usr.OrgID]
	if !ok {
		return nil, nil // org not found
	}
	ds, ok := v[uid]
	if !ok {
		return nil, nil // data source not found
	}
	return ds, nil
}
