package query

import (
	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

type pluginsCache struct {
	cache *v0alpha1.DataSourceList
}
