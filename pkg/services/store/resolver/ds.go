package resolver

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/store"
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
	db             db.DB
	pluginRegistry registry.Service
	cache          map[int64]map[string]*dsVal
	timestamp      time.Time // across all orgIDs
	mu             sync.Mutex
}

func (c *dsCache) check(ctx context.Context) error {
	old := c.timestamp

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.timestamp != old {
		return nil // already updated while we waited!
	}

	cache := make(map[int64]map[string]*dsVal, 0)
	defaultDS := make(map[int64]*dsVal, 0)

	rows, err := c.db.GetSqlxSession().Query(ctx,
		"SELECT org_id,id,is_default,name,type,UID FROM data_source")
	if err != nil {
		return err
	}

	orgID := int64(0)
	for rows.Next() {
		val := &dsVal{}
		err = rows.Scan(&orgID, &val.InternalID, &val.IsDefault, &val.Name, &val.Type, &val.UID)
		if err == nil {
			_, ok := c.pluginRegistry.Plugin(ctx, val.Type)
			val.PluginExists = ok

			orgCache, ok := cache[orgID]
			if !ok {
				orgCache = make(map[string]*dsVal, 0)
				cache[orgID] = orgCache
			}

			orgCache[val.UID] = val

			// Empty string or
			if val.IsDefault {
				defaultDS[orgID] = val
			}
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
			Name:         grafanads.DatasourceUID,
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
		orgDSCache["default"] = ds
	}

	c.cache = cache
	c.timestamp = getNow()
	return nil
}

func (c *dsCache) getDS(ctx context.Context, uid string) (*dsVal, error) {
	var err error

	// refresh cache every 1 min
	if c.cache == nil || c.timestamp.Before(getNow().Add(time.Minute*-1)) {
		err = c.check(ctx)
	}

	orgID := store.UserFromContext(ctx).OrgID

	v, ok := c.cache[orgID]
	if !ok {
		return nil, err // org not found
	}
	ds, ok := v[uid]
	if !ok {
		return nil, err // data source not found
	}
	return ds, err
}
