package query

import (
	"sync"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

type registry struct {
	plugins        *v0alpha1.DataSourcePluginList
	pluginsMu      sync.RWMutex
	pluginsChecked int64

	datasources   map[string]dsCache
	datasourcesMu sync.RWMutex
}

type dsCache struct {
	cache   *v0alpha1.DataSourceList
	mu      sync.RWMutex
	checked int64
}
