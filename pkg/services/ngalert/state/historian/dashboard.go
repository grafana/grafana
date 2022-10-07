package historian

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/patrickmn/go-cache"
)

const dashboardNotFound = -1

const defaultDashboardCacheExpiry = 1 * time.Minute

// dashboardResolver resolves dashboard UIDs to IDs with caching.
type dashboardResolver struct {
	dashboards dashboards.DashboardService
	cache      *cache.Cache
	lock       sync.Mutex
	log        log.Logger
}

func newDashboardResolver(dbs dashboards.DashboardService, log log.Logger, expiry time.Duration) *dashboardResolver {
	return &dashboardResolver{
		dashboards: dbs,
		cache:      cache.New(expiry, 2*expiry),
		log:        log,
	}
}

// getId gets the ID of the dashboard with the given uid/orgID combination, or returns dashboardNotFound if the dashboard does not exist.
func (r *dashboardResolver) getId(ctx context.Context, orgID int64, uid string) (int64, error) {
	// Optimistically query without acquiring lock. This works because cache.Cache is thread-safe.
	// That way, we don't block valid queries on unrelated cache misses.
	// We use a double-checked lock to prevent queries from being needlessly ran.
	if id, found := r.cache.Get(packCacheKey(orgID, uid)); found {
		return id.(int64), nil
	}

	r.lock.Lock()
	defer r.lock.Unlock()

	if id, found := r.cache.Get(packCacheKey(orgID, uid)); found {
		return id.(int64), nil
	}

	r.log.Debug("dashboard cache miss, querying dashboards", "dashboardUID", uid)

	query := &models.GetDashboardQuery{
		Uid:   uid,
		OrgId: orgID,
	}
	err := r.dashboards.GetDashboard(ctx, query)
	if err != nil {
		return 0, err
	}

	var id int64
	if query.Result != nil {
		id = query.Result.Id
	} else {
		id = dashboardNotFound
	}

	r.cache.Set(packCacheKey(orgID, uid), id, cache.DefaultExpiration)

	return id, nil
}

func packCacheKey(orgID int64, uid string) string {
	const base = 10
	return strconv.FormatInt(orgID, base) + "-" + uid
}
