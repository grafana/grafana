package sqleng

import (
	"database/sql"
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"xorm.io/core"
)

func TestSQLEngine(t *testing.T) {
	dt := time.Date(2018, 3, 14, 21, 20, 6, int(527345*time.Microsecond), time.UTC)
	earlyDt := time.Date(1970, 3, 14, 21, 20, 6, int(527345*time.Microsecond), time.UTC)

	t.Run("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func(t *testing.T) {
		from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
		to := from.Add(5 * time.Minute)
		timeRange := plugins.DataTimeRange{From: "5m", To: "now", Now: to}
		query := plugins.DataSubQuery{DataSource: &models.DataSource{}, Model: simplejson.New()}

		t.Run("interpolate $__interval", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "select $__interval ")
			require.NoError(t, err)
			require.Equal(t, "select 1m ", sql)
		})

		t.Run("interpolate $__interval in $__timeGroup", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "select $__timeGroupAlias(time,$__interval)")
			require.NoError(t, err)
			require.Equal(t, "select $__timeGroupAlias(time,1m)", sql)
		})

		t.Run("interpolate $__interval_ms", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "select $__interval_ms ")
			require.NoError(t, err)
			require.Equal(t, "select 60000 ", sql)
		})

		t.Run("interpolate __unixEpochFrom function", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "select $__unixEpochFrom()")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select %d", from.Unix()), sql)
		})

		t.Run("interpolate __unixEpochTo function", func(t *testing.T) {
			sql, err := Interpolate(query, timeRange, "select $__unixEpochTo()")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select %d", to.Unix()), sql)
		})
	})

	t.Run("Given row values with time.Time as time columns", func(t *testing.T) {
		var nilPointer *time.Time

		fixtures := make([]interface{}, 5)
		fixtures[0] = dt
		fixtures[1] = &dt
		fixtures[2] = earlyDt
		fixtures[3] = &earlyDt
		fixtures[4] = nilPointer

		for i := range fixtures {
			ConvertSqlTimeColumnToEpochMs(fixtures, i)
		}

		expected := float64(dt.UnixNano()) / float64(time.Millisecond)
		expectedEarly := float64(earlyDt.UnixNano()) / float64(time.Millisecond)

		require.Equal(t, expected, fixtures[0].(float64))
		require.Equal(t, expected, fixtures[1].(float64))
		require.Equal(t, expectedEarly, fixtures[2].(float64))
		require.Equal(t, expectedEarly, fixtures[3].(float64))
		require.Nil(t, fixtures[4])
	})

	t.Run("Given row values with int64 as time columns", func(t *testing.T) {
		tSeconds := dt.Unix()
		tMilliseconds := dt.UnixNano() / 1e6
		tNanoSeconds := dt.UnixNano()
		var nilPointer *int64

		fixtures := make([]interface{}, 7)
		fixtures[0] = tSeconds
		fixtures[1] = &tSeconds
		fixtures[2] = tMilliseconds
		fixtures[3] = &tMilliseconds
		fixtures[4] = tNanoSeconds
		fixtures[5] = &tNanoSeconds
		fixtures[6] = nilPointer

		for i := range fixtures {
			ConvertSqlTimeColumnToEpochMs(fixtures, i)
		}

		require.Equal(t, tSeconds*1e3, fixtures[0].(int64))
		require.Equal(t, tSeconds*1e3, fixtures[1].(int64))
		require.Equal(t, tMilliseconds, fixtures[2].(int64))
		require.Equal(t, tMilliseconds, fixtures[3].(int64))
		require.Equal(t, tMilliseconds, fixtures[4].(int64))
		require.Equal(t, tMilliseconds, fixtures[5].(int64))
		require.Nil(t, fixtures[6])
	})

	t.Run("Given row values with uint64 as time columns", func(t *testing.T) {
		tSeconds := uint64(dt.Unix())
		tMilliseconds := uint64(dt.UnixNano() / 1e6)
		tNanoSeconds := uint64(dt.UnixNano())
		var nilPointer *uint64

		fixtures := make([]interface{}, 7)
		fixtures[0] = tSeconds
		fixtures[1] = &tSeconds
		fixtures[2] = tMilliseconds
		fixtures[3] = &tMilliseconds
		fixtures[4] = tNanoSeconds
		fixtures[5] = &tNanoSeconds
		fixtures[6] = nilPointer

		for i := range fixtures {
			ConvertSqlTimeColumnToEpochMs(fixtures, i)
		}

		require.Equal(t, int64(tSeconds*1e3), fixtures[0].(int64))
		require.Equal(t, int64(tSeconds*1e3), fixtures[1].(int64))
		require.Equal(t, int64(tMilliseconds), fixtures[2].(int64))
		require.Equal(t, int64(tMilliseconds), fixtures[3].(int64))
		require.Equal(t, int64(tMilliseconds), fixtures[4].(int64))
		require.Equal(t, int64(tMilliseconds), fixtures[5].(int64))
		require.Nil(t, fixtures[6])
	})

	t.Run("Given row values with int32 as time columns", func(t *testing.T) {
		tSeconds := int32(dt.Unix())
		var nilInt *int32

		fixtures := make([]interface{}, 3)
		fixtures[0] = tSeconds
		fixtures[1] = &tSeconds
		fixtures[2] = nilInt

		for i := range fixtures {
			ConvertSqlTimeColumnToEpochMs(fixtures, i)
		}

		require.Equal(t, dt.Unix()*1e3, fixtures[0].(int64))
		require.Equal(t, dt.Unix()*1e3, fixtures[1].(int64))
		require.Nil(t, fixtures[2])
	})

	t.Run("Given row values with uint32 as time columns", func(t *testing.T) {
		tSeconds := uint32(dt.Unix())
		var nilInt *uint32

		fixtures := make([]interface{}, 3)
		fixtures[0] = tSeconds
		fixtures[1] = &tSeconds
		fixtures[2] = nilInt

		for i := range fixtures {
			ConvertSqlTimeColumnToEpochMs(fixtures, i)
		}

		require.Equal(t, dt.Unix()*1e3, fixtures[0].(int64))
		require.Equal(t, dt.Unix()*1e3, fixtures[1].(int64))
		require.Nil(t, fixtures[2])
	})

	t.Run("Given row values with float64 as time columns", func(t *testing.T) {
		tSeconds := float64(dt.UnixNano()) / float64(time.Second)
		tMilliseconds := float64(dt.UnixNano()) / float64(time.Millisecond)
		tNanoSeconds := float64(dt.UnixNano())
		var nilPointer *float64

		fixtures := make([]interface{}, 7)
		fixtures[0] = tSeconds
		fixtures[1] = &tSeconds
		fixtures[2] = tMilliseconds
		fixtures[3] = &tMilliseconds
		fixtures[4] = tNanoSeconds
		fixtures[5] = &tNanoSeconds
		fixtures[6] = nilPointer

		for i := range fixtures {
			ConvertSqlTimeColumnToEpochMs(fixtures, i)
		}

		require.Equal(t, tMilliseconds, fixtures[0].(float64))
		require.Equal(t, tMilliseconds, fixtures[1].(float64))
		require.Equal(t, tMilliseconds, fixtures[2].(float64))
		require.Equal(t, tMilliseconds, fixtures[3].(float64))
		require.Equal(t, tMilliseconds, fixtures[4].(float64))
		require.Equal(t, tMilliseconds, fixtures[5].(float64))
		require.Nil(t, fixtures[6])
	})

	t.Run("Given row values with float32 as time columns", func(t *testing.T) {
		tSeconds := float32(dt.Unix())
		var nilInt *float32

		fixtures := make([]interface{}, 3)
		fixtures[0] = tSeconds
		fixtures[1] = &tSeconds
		fixtures[2] = nilInt

		for i := range fixtures {
			ConvertSqlTimeColumnToEpochMs(fixtures, i)
		}

		require.Equal(t, float64(tSeconds)*1e3, fixtures[0].(float64))
		require.Equal(t, float64(tSeconds)*1e3, fixtures[1].(float64))
		require.Nil(t, fixtures[2])
	})

	t.Run("Given row with value columns", func(t *testing.T) {
		intValue := 1
		int64Value := int64(1)
		int32Value := int32(1)
		int16Value := int16(1)
		int8Value := int8(1)
		float64Value := float64(1)
		float32Value := float32(1)
		uintValue := uint(1)
		uint64Value := uint64(1)
		uint32Value := uint32(1)
		uint16Value := uint16(1)
		uint8Value := uint8(1)

		testCases := []struct {
			name  string
			value interface{}
		}{
			{"intValue", intValue},
			{"&intValue", &intValue},
			{"int64Value", int64Value},
			{"&int64Value", &int64Value},
			{"int32Value", int32Value},
			{"&int32Value", &int32Value},
			{"int16Value", int16Value},
			{"&int16Value", &int16Value},
			{"int8Value", int8Value},
			{"&int8Value", &int8Value},
			{"float64Value", float64Value},
			{"&float64Value", &float64Value},
			{"float32Value", float32Value},
			{"&float32Value", &float32Value},
			{"uintValue", uintValue},
			{"&uintValue", &uintValue},
			{"uint64Value", uint64Value},
			{"&uint64Value", &uint64Value},
			{"uint32Value", uint32Value},
			{"&uint32Value", &uint32Value},
			{"uint16Value", uint16Value},
			{"&uint16Value", &uint16Value},
			{"uint8Value", uint8Value},
			{"&uint8Value", &uint8Value},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				value, err := ConvertSqlValueColumnToFloat("col", tc.value)
				require.NoError(t, err)
				require.True(t, value.Valid)
				require.Equal(t, null.FloatFrom(1).Float64, value.Float64)
			})
		}
	})

	t.Run("Given row with nil value columns", func(t *testing.T) {
		var intNilPointer *int
		var int64NilPointer *int64
		var int32NilPointer *int32
		var int16NilPointer *int16
		var int8NilPointer *int8
		var float64NilPointer *float64
		var float32NilPointer *float32
		var uintNilPointer *uint
		var uint64NilPointer *uint64
		var uint32NilPointer *uint32
		var uint16NilPointer *uint16
		var uint8NilPointer *uint8

		testCases := []struct {
			name  string
			value interface{}
		}{
			{"intNilPointer", intNilPointer},
			{"int64NilPointer", int64NilPointer},
			{"int32NilPointer", int32NilPointer},
			{"int16NilPointer", int16NilPointer},
			{"int8NilPointer", int8NilPointer},
			{"float64NilPointer", float64NilPointer},
			{"float32NilPointer", float32NilPointer},
			{"uintNilPointer", uintNilPointer},
			{"uint64NilPointer", uint64NilPointer},
			{"uint32NilPointer", uint32NilPointer},
			{"uint16NilPointer", uint16NilPointer},
			{"uint8NilPointer", uint8NilPointer},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				value, err := ConvertSqlValueColumnToFloat("col", tc.value)
				require.NoError(t, err)
				require.False(t, value.Valid)
			})
		}
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
			dp := dataPlugin{
				log:                    log.New("test"),
				queryResultTransformer: transformer,
			}
			resultErr := dp.transformQueryError(tc.err)
			assert.ErrorIs(t, resultErr, tc.expectedErr)
			assert.Equal(t, tc.expectQueryResultTransformerWasCalled, transformer.transformQueryErrorWasCalled)
		}
	})
}

type testQueryResultTransformer struct {
	transformQueryErrorWasCalled bool
}

func (t *testQueryResultTransformer) TransformQueryResult(columnTypes []*sql.ColumnType, rows *core.Rows) (plugins.DataRowValues, error) {
	return nil, nil
}

func (t *testQueryResultTransformer) TransformQueryError(err error) error {
	t.transformQueryErrorWasCalled = true
	return err
}
