package sqlstash

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/require"

	oldDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIsHealthy(t *testing.T) {
	s := setUpTestServer(t)

	_, err := s.IsHealthy(context.Background(), &entity.HealthCheckRequest{})
	require.NoError(t, err)
}

func setUpTestServer(t *testing.T) entity.EntityStoreServer {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	sqlStore, cfg := oldDB.InitTestDBWithCfg(t)

	entityDB, err := dbimpl.ProvideEntityDB(
		sqlStore,
		cfg,
		featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorage),
		nil,
	)
	require.NoError(t, err)

	traceConfig, err := tracing.ParseTracingConfig(cfg)
	require.NoError(t, err)
	tracer, err := tracing.ProvideService(traceConfig)
	require.NoError(t, err)

	s, err := ProvideSQLEntityServer(entityDB, tracer)
	require.NoError(t, err)
	return s
}

// TODO: remove all the following once the Proposal 1 for Consistent Resource
// Version is finished.
var (
	_ = parseAllSortBy
	_ = countTrue
	_ = query
	_ = sqlEntityHistory
	_ = sqlEntityRefFind
	_ = sqlKindVersionGet
	_ = sqlEntityRefFindRequest{}
	_ = sqlKindVersionGetRequest{}
	_ = sqlEntityHistoryRequest{}
	_ = sqlEntityHistoryListRequest{}
)
