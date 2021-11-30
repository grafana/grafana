package database

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/prometheus/client_golang/prometheus"
)

var LastUpdateTime time.Time
var MetricCacheInterval time.Duration = 60 * time.Second
var once sync.Once
var updateMutex sync.Mutex
var cache sync.Map

const ExporterName = "grafana"

func (sa *ServiceAccountsStoreImpl) makeMetric(name, help string) prometheus.GaugeFunc {
	return prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Namespace: ExporterName,
			Name:      name,
			Help:      help,
		},
		func() float64 {
			return sa.GetMetric(name)
		},
	)
}

func (sa *ServiceAccountsStoreImpl) InitMetrics() {
	once.Do(func() {
		prometheus.MustRegister(
			sa.makeMetric("serviceaccounts_count", "Gauge for total number of serviceaccount."),
			// TODO: apikeys
		)
	})
}

func (sa *ServiceAccountsStoreImpl) GetMetric(name string) float64 {
	sa.CacheMetrics()
	ret, _ := cache.Load(name)
	return float64(ret.(int))
}

//Load and cache entity counts.  Don't do it more often than MetricCacheInterval
func (sa *ServiceAccountsStoreImpl) CacheMetrics() {
	updateMutex.Lock()
	defer updateMutex.Unlock()
	if LastUpdateTime.UTC().Add(MetricCacheInterval).Before(time.Now()) {
		LastUpdateTime = time.Now()
		cache.Store("serviceaccounts_count", sa.CountTable("user"))
		// TODO: apikeys
	}
}

//Counts the number of rows in a table.  Only use trusted strings.
func (sa *ServiceAccountsStoreImpl) CountTable(table string) int {
	var result int = -1
	_ = sa.sqlStore.WithDbSession(context.TODO(), func(sess *sqlstore.DBSession) error {
		// TODO: sanitize plz
		_, err := sess.SQL("SELECT count(1) FROM " + table + " where is_service_account = true").Get(&result)
		return err
	})
	return result
}
