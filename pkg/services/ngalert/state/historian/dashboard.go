package historian

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/patrickmn/go-cache"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

const (
	defaultDashboardCacheExpiry = 1 * time.Minute
	minCleanupInterval          = 1 * time.Second
)

// dashboardResolver resolves dashboard UIDs to IDs with caching.
type dashboardResolver struct {
	dashboards   dashboards.DashboardService
	cache        *cache.Cache
	singleflight singleflight.Group
	log          log.Logger
}

func newDashboardResolver(dbs dashboards.DashboardService, expiry time.Duration) *dashboardResolver {
	return &dashboardResolver{
		dashboards:   dbs,
		cache:        cache.New(expiry, maxDuration(2*expiry, minCleanupInterval)),
		singleflight: singleflight.Group{},
		log:          log.New("ngalert.dashboard-resolver"),
	}
}

// getId gets the ID of the dashboard with the given uid/orgID combination, or returns dashboardNotFound if the dashboard does not exist.
func (r *dashboardResolver) getID(ctx context.Context, orgID int64, uid string) (int64, error) {
	// Optimistically query without acquiring lock. This is okay because cache.Cache is thread-safe.
	// We don't need to lock anything ourselves on cache miss, because singleflight will lock for us within a given key.
	// Different keys which correspond to different queries will never block each other.
	key := packCacheKey(orgID, uid)

	if id, found := r.cache.Get(key); found {
		return toQueryResult(id, nil)
	}

	id, err, _ := r.singleflight.Do(key, func() (interface{}, error) {
		r.log.Debug("Dashboard cache miss, querying dashboards", "dashboardUID", uid)

		var result interface{}
		query := &dashboards.GetDashboardQuery{
			UID:   uid,
			OrgID: orgID,
		}
		queryResult, err := r.dashboards.GetDashboard(ctx, query)
		// We also cache lookups where we don't find anything.
		if err != nil && errors.Is(err, dashboards.ErrDashboardNotFound) {
			result = err
		} else if err != nil {
			return 0, err
		} else if queryResult == nil {
			result = dashboards.ErrDashboardNotFound
		} else {
			result = queryResult.ID
		}

		// By setting the cache inside the singleflighted routine, we avoid any accidental re-queries that could get initiated after the query completes.
		r.cache.Set(key, result, cache.DefaultExpiration)
		return result, nil
	})

	return toQueryResult(id, err)
}

func packCacheKey(orgID int64, uid string) string {
	const base = 10
	return strconv.FormatInt(orgID, base) + "-" + uid
}

func maxDuration(a, b time.Duration) time.Duration {
	if a >= b {
		return a
	}
	return b
}

func toQueryResult(cacheVal interface{}, err error) (int64, error) {
	if err != nil {
		return 0, err
	}

	switch cacheVal := cacheVal.(type) {
	case error:
		return 0, cacheVal
	case int64:
		return cacheVal, err
	default:
		panic(fmt.Sprintf("unexpected value stored in cache: %#v", cacheVal))
	}
}
