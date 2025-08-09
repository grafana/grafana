package database

import (
	"context"
	"fmt"
	"maps"

	"github.com/grafana/grafana/pkg/infra/db"
)

// countZanzanaTuples returns the number of tuples stored with zanzana
func (s *AccessControlStore) countZanzanaTuples(ctx context.Context) (map[string]interface{}, error) {
	// Test URL: http://localhost:3000/api/admin/usage-report-preview
	// TODO embedded uses its own sqlite db: data/zanzana.db -- the SQL store here is for data/grafana.db so this query fails (no tuple table)
	// TODO test in standalone
	query := `SELECT COUNT(*) as count FROM tuple` // TODO maybe don't need the alias

	var result struct {
		Count int64
	}

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.SQL(query).Get(&result); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"stats.accesscontrol.zanzana.tuples.count": result.Count,
	}, nil
}

func (s *AccessControlStore) GetUsageStats(ctx context.Context) map[string]any {
	metricsMap := make(map[string]interface{})
	collectFuncs := map[string]func(context.Context) (map[string]any, error){
		"countZanzanaTuples": s.countZanzanaTuples,
	}

	for name, fn := range collectFuncs {
		stats, err := fn(ctx)
		if err != nil {
			s.logger.Error(fmt.Sprintf("error in func %s: %v", name, err))
			continue
		}
		maps.Copy(metricsMap, stats)
	}
	return metricsMap
}
