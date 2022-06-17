package database

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/prometheus/client_golang/prometheus"
)

const ExporterName = "grafana"

type Stats struct {
	DuplicateUserEntries int `xorm:"duplicate_user_entries"`
}

var LastUpdateTime time.Time
var MetricCacheInterval time.Duration = 60 * time.Second
var cache sync.Map
var updateMutex sync.Mutex

func (s *AuthInfoStore) makeMetric(name, help string) prometheus.GaugeFunc {
	return prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Namespace: ExporterName,
			Name:      name,
			Help:      help,
		},
		func() float64 {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			err := s.cacheMetrics(ctx)
			ret, ok := cache.Load(name)
			if !ok || err != nil {
				s.logger.Info("Error loading metric", "name", name, "error", err)
				return -1 // context timed out
			}
			return float64(ret.(int))
		},
	)
}

func (s *AuthInfoStore) InitMetrics() {
	once.Do(func() {
		prometheus.MustRegister(
			//If you add a line here, you must also add it to CacheMetrics
			s.makeMetric("duplicate_user_entries", "Gauge for number of user duplicate entries."),
		)
	})
}

//Load and cache entity counts.  Don't do it more often than MetricCacheInterval
func (s *AuthInfoStore) cacheMetrics(ctx context.Context) error {
	updateMutex.Lock()
	defer updateMutex.Unlock()
	if LastUpdateTime.UTC().Add(MetricCacheInterval).Before(time.Now()) {
		LastUpdateTime = time.Now()
		//If you add a line here, you also have to add a line to InitMetrics
		stats, err := s.GetMetrics(ctx)
		if err != nil {
			return err
		}
		cache.Store("duplicate_user_entries", stats.DuplicateUserEntries)
	}

	return nil
}

// Retrieve entity counts from the database, used for metrics and usage data
func (s *AuthInfoStore) GetMetrics(ctx context.Context) (*Stats, error) {
	stats := Stats{}
	sb := &sqlstore.SQLBuilder{}
	err := s.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {

		sb.Write("SELECT ")
		sb.Write(`(SELECT COUNT(*) FROM (` + s.duplicateUserEntriesSQL(ctx) + `)) AS duplicate_user_entries`)

		if _, err := sess.SQL(sb.GetSQLString(), sb.GetParams()...).Get(&stats); err != nil {
			return err
		}

		return nil
	})

	return &stats, err
}
