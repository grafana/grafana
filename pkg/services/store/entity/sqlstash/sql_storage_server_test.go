package sqlstash

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIsHealthy(t *testing.T) {
	t.Parallel()

	// test declarations
	ctx := testutil.NewDefaultTestContext(t)
	db, mock := newMockDBNopSQL(t)
	s := &sqlEntityServer{
		sqlDB: db,
	}

	// setup expectations
	mock.ExpectPing()

	// execute and assert
	_, err := s.IsHealthy(ctx, new(entity.HealthCheckRequest))
	require.NoError(t, err)
}
