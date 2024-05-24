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

// TODO:
// The testing strategy for this package is devided in layers of abstraction in
// order to provide correctness, coverage and maintainability of tests. The
// layers are the following, from most concrete to more abstract:
//	1. Simple utility functions should be tested using the author's best
//	   criteria.
//	2. Utility functions that deal with low-level database operations (like
//	   Query, QueryContext, Exec, etc.) should be tested with sqlmock and they
//	   do not need to assert SQL code. Instead, focus on testing that it
//	   correctly handles all the lower level code flows.
//	3. SQL generated from templates should be tested using golden tests, using
//	   at least the sqltemplate.MySQL dialect, and exercising every template
//	   code branch at least once. For each loop (with the template `range`
//	   keyword), the template should be exercised at least once with zero, one
//	   and two elements. Use the function TestGenerateSQLExample in
//	   queries_test.go to generate your golden files.
//	2. Methods from the Entity Server implementation can omit testing the
//	   executed

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
