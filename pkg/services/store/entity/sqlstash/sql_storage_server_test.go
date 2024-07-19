package sqlstash

import (
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	traceNoop "go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func newTestSQLEntityServer(t *testing.T) (*sqlEntityServer, sqlmock.Sqlmock) {
	db, mock := newMockDBMatchWords(t)

	return &sqlEntityServer{
		log:    log.NewNopLogger(),
		tracer: traceNoop.NewTracerProvider().Tracer("test-tracer"),

		sess: new(session.SessionDB), // FIXME

		sqlDB:      db,
		sqlDialect: sqltemplate.MySQL,
	}, mock
}

func TestIsHealthy(t *testing.T) {
	t.Parallel()

	// test declarations
	ctx := testutil.NewDefaultTestContext(t)
	s, mock := newTestSQLEntityServer(t)

	// setup expectations
	mock.ExpectPing()

	// execute and assert
	_, err := s.IsHealthy(ctx, new(entity.HealthCheckRequest))
	require.NoError(t, err)
}
