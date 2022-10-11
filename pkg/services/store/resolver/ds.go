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

func (c *dsCache) check(ctx context.Context) {
	old := c.timestamp

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.timestamp != old {
		return // already updated while we waited!
	}

	// Need the orgID from the current user (must set in background tasks?!)
	cache := make(map[int64]map[string]*dsVal, 0)
	defaultDS := make(map[int64]*dsVal, 0)

	rows, err := c.db.GetSqlxSession().Query(ctx,
		"SELECT org_id,id,is_default,name,type,UID FROM data_source")
	if err == nil {
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

		for orgID, dscache := range cache {
			// modifies the cache we are iterating over?
			for _, ds := range dscache {
				// Lookup by internal ID
				id := fmt.Sprintf("%d", ds.InternalID)
				_, ok := dscache[id]
				if !ok {
					dscache[id] = ds
				}

				// Lookup by name
				_, ok = dscache[ds.Name]
				if !ok {
					dscache[ds.Name] = ds
				}
			}

			ds, ok := defaultDS[orgID]
			if ok {
				dscache[""] = ds
				dscache["default"] = ds
			}
		}
	} else {
		// ?? empty cache?
		// log error message?
		fmt.Printf("ERROR: %v", err)
	}

	c.cache = cache
	c.timestamp = getNow()
}

func (c *dsCache) getDS(ctx context.Context, uid string) dsVal {
	// Builtin grafana datasource
	if uid == grafanads.DatasourceUID {
		return dsVal{Name: grafanads.DatasourceName, Type: grafanads.DatasourceUID, UID: grafanads.DatasourceUID}
	}

	// refresh cache every 1 min
	if c.cache == nil || c.timestamp.Before(getNow().Add(time.Minute*-1)) {
		c.check(ctx)
	}

	orgID := store.UserFromContext(ctx).OrgID

	v, ok := c.cache[orgID]
	if !ok {
		return dsVal{}
	}
	ds, ok := v[uid]
	if ok {
		return *ds
	}
	return dsVal{} // not found
}
