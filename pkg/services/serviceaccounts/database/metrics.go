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

func (saStore *ServiceAccountsStoreImpl) makeMetric(name, help string) prometheus.GaugeFunc {
	return prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Namespace: ExporterName,
			Name:      name,
			Help:      help,
		},
		func() float64 {
			saStore.CacheMetrics()
			ret, _ := cache.Load(name)
			return float64(ret.(int))
		},
	)
}

func (saStore *ServiceAccountsStoreImpl) InitMetrics() {
	once.Do(func() {
		prometheus.MustRegister(
			//If you add a line here, you must also add it to CacheMetrics
			saStore.makeMetric("serviceaccount_count", "Gauge for total number of serviceaccounts."),
		)
	})
}

//Load and cache entity counts.  Don't do it more often than MetricCacheInterval
func (saStore *ServiceAccountsStoreImpl) CacheMetrics() {
	updateMutex.Lock()
	defer updateMutex.Unlock()
	if LastUpdateTime.UTC().Add(MetricCacheInterval).Before(time.Now()) {
		LastUpdateTime = time.Now()
		//If you add a line here, you also have to add a line to InitMetrics
		cache.Store("serviceaccount_count", saStore.CountTable("role"))
	}
}

//Counts the number of rows in a table.  Only use trusted strings.
func (saStore *ServiceAccountsStoreImpl) CountTable(table string) int {
	var result int = -1
	_ = saStore.sqlStore.WithDbSession(context.TODO(), func(sess *sqlstore.DBSession) error {
		_, err := sess.SQL("SELECT count(1) FROM user where is_service_account = true").Get(&result)
		return err
	})
	return result
}
