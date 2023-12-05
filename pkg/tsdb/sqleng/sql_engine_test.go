package sqleng

import (
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestSQLEngine(t *testing.T) {
	t.Run("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func(t *testing.T) {
		from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
		to := from.Add(5 * time.Minute)
		timeRange := backend.TimeRange{From: from, To: to}
		query := backend.DataQuery{JSON: []byte("{}")}

		t.Run("interpolate $__interval", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "", "select $__interval ")
			require.NoError(t, err)
			require.Equal(t, "select 1m ", sql)
		})

		t.Run("interpolate $__interval in $__timeGroup", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "", "select $__timeGroupAlias(time,$__interval)")
			require.NoError(t, err)
			require.Equal(t, "select $__timeGroupAlias(time,1m)", sql)
		})

		t.Run("interpolate $__interval_ms", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "", "select $__interval_ms ")
			require.NoError(t, err)
			require.Equal(t, "select 60000 ", sql)
		})

		t.Run("interpolate __unixEpochFrom function", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "", "select $__unixEpochFrom()")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select %d", from.Unix()), sql)
		})

		t.Run("interpolate __unixEpochTo function", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "", "select $__unixEpochTo()")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select %d", to.Unix()), sql)
		})
	})

	t.Run("Should handle connection errors", func(t *testing.T) {
		randomErr := fmt.Errorf("random error")

		tests := []struct {
			err                                   error
			expectedErr                           error
			expectQueryResultTransformerWasCalled bool
		}{
			{err: &net.OpError{Op: "Dial"}, expectedErr: ErrConnectionFailed, expectQueryResultTransformerWasCalled: false},
			{err: randomErr, expectedErr: randomErr, expectQueryResultTransformerWasCalled: true},
		}

		for _, tc := range tests {
			transformer := &testQueryResultTransformer{}
			dp := DataSourceHandler{
				log:                    log.New("test"),
				queryResultTransformer: transformer,
			}
			resultErr := dp.TransformQueryError(dp.log, tc.err)
			assert.ErrorIs(t, resultErr, tc.expectedErr)
			assert.Equal(t, tc.expectQueryResultTransformerWasCalled, transformer.transformQueryErrorWasCalled)
		}
	})
}

type testQueryResultTransformer struct {
	transformQueryErrorWasCalled bool
}

func (t *testQueryResultTransformer) TransformQueryError(_ log.Logger, err error) error {
	t.transformQueryErrorWasCalled = true
	return err
}

func (t *testQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	return nil
}
