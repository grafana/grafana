package dashboards

import (
	"github.com/grafana/grafana/pkg/services/dashboards"
	gocache "github.com/patrickmn/go-cache"
	"time"
)

type dashboardCache struct {
	internalCache *gocache.Cache
}

func NewDashboardCache() *dashboardCache {
	return &dashboardCache{internalCache: gocache.New(5*time.Minute, 30*time.Minute)}
}

func (fr *dashboardCache) addDashboardCache(key string, json *dashboards.SaveDashboardItem) {
	fr.internalCache.Add(key, json, time.Minute*10)
}

func (fr *dashboardCache) getCache(key string) (*dashboards.SaveDashboardItem, bool) {
	obj, exist := fr.internalCache.Get(key)
	if !exist {
		return nil, exist
	}

	dash, ok := obj.(*dashboards.SaveDashboardItem)
	if !ok {
		return nil, ok
	}

	return dash, ok
}
