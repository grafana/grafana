package statscollector

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

const concurrentUserStatsCacheLifetime = time.Hour

type concurrentUsersStats struct {
	BucketLE3   int32 `xorm:"bucket_le_3"`
	BucketLE6   int32 `xorm:"bucket_le_6"`
	BucketLE9   int32 `xorm:"bucket_le_9"`
	BucketLE12  int32 `xorm:"bucket_le_12"`
	BucketLE15  int32 `xorm:"bucket_le_15"`
	BucketLEInf int32 `xorm:"bucket_le_inf"`
}

type memoConcurrentUserStats struct {
	stats *concurrentUsersStats

	memoized time.Time
}

func (s *Service) concurrentUsers(ctx context.Context) (*concurrentUsersStats, error) {
	memoizationPeriod := time.Now().Add(-concurrentUserStatsCacheLifetime)
	if !s.concurrentUserStatsCache.memoized.Before(memoizationPeriod) {
		return s.concurrentUserStatsCache.stats, nil
	}

	s.concurrentUserStatsCache.stats = &concurrentUsersStats{}
	err := s.sqlstore.WithDbSession(ctx, func(sess *db.Session) error {
		// Retrieves concurrent users stats as a histogram. Buckets are accumulative and upper bound is inclusive.
		rawSQL := `
SELECT
    COUNT(CASE WHEN tokens <= 3 THEN 1 ELSE NULL END) AS bucket_le_3,
    COUNT(CASE WHEN tokens <= 6 THEN 1 ELSE NULL END) AS bucket_le_6,
    COUNT(CASE WHEN tokens <= 9 THEN 1 ELSE NULL END) AS bucket_le_9,
    COUNT(CASE WHEN tokens <= 12 THEN 1 ELSE NULL END) AS bucket_le_12,
    COUNT(CASE WHEN tokens <= 15 THEN 1 ELSE NULL END) AS bucket_le_15,
    COUNT(1) AS bucket_le_inf
FROM (select count(1) as tokens from user_auth_token group by user_id) uat;`
		_, err := sess.SQL(rawSQL).Get(s.concurrentUserStatsCache.stats)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get concurrent users stats from database: %w", err)
	}

	s.concurrentUserStatsCache.memoized = time.Now()
	return s.concurrentUserStatsCache.stats, nil
}

func (s *Service) collectConcurrentUsers(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	// Get concurrent users stats as histogram
	concurrentUsersStats, err := s.concurrentUsers(ctx)
	if err != nil {
		s.log.Error("Failed to get concurrent users stats", "error", err)
		return nil, err
	}

	// Histogram is cumulative and metric name has a postfix of le_"<upper inclusive bound>"
	m["stats.auth_token_per_user_le_3"] = concurrentUsersStats.BucketLE3
	m["stats.auth_token_per_user_le_6"] = concurrentUsersStats.BucketLE6
	m["stats.auth_token_per_user_le_9"] = concurrentUsersStats.BucketLE9
	m["stats.auth_token_per_user_le_12"] = concurrentUsersStats.BucketLE12
	m["stats.auth_token_per_user_le_15"] = concurrentUsersStats.BucketLE15
	m["stats.auth_token_per_user_le_inf"] = concurrentUsersStats.BucketLEInf

	return m, nil
}
