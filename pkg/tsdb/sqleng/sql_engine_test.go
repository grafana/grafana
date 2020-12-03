package sqleng

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/stretchr/testify/require"
)

func TestSqlEngine(t *testing.T) {
	dt := time.Date(2018, 3, 14, 21, 20, 6, int(527345*time.Microsecond), time.UTC)
	earlyDt := time.Date(1970, 3, 14, 21, 20, 6, int(527345*time.Microsecond), time.UTC)

	t.Run("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func(t *testing.T) {
		from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
		to := from.Add(5 * time.Minute)
		timeRange := tsdb.NewFakeTimeRange("5m", "now", to)
		query := &tsdb.Query{DataSource: &models.DataSource{}, Model: simplejson.New()}

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

		t.Run("When converting them should return epoch time with millisecond precision", func(t *testing.T) {
			expected := float64(dt.UnixNano()) / float64(time.Millisecond)
			expectedEarly := float64(earlyDt.UnixNano()) / float64(time.Millisecond)

			require.Equal(t, expected, fixtures[0].(float64))
			require.Equal(t, expected, fixtures[1].(float64))
			require.Equal(t, expectedEarly, fixtures[2].(float64))
			require.Equal(t, expectedEarly, fixtures[3].(float64))
			require.Nil(t, fixtures[4])
		})
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

		t.Run("When converting them should return epoch time with millisecond precision", func(t *testing.T) {
			require.Equal(t, tSeconds*1e3, fixtures[0].(int64))
			require.Equal(t, tSeconds*1e3, fixtures[1].(int64))
			require.Equal(t, tMilliseconds, fixtures[2].(int64))
			require.Equal(t, tMilliseconds, fixtures[3].(int64))
			require.Equal(t, tMilliseconds, fixtures[4].(int64))
			require.Equal(t, tMilliseconds, fixtures[5].(int64))
			require.Nil(t, fixtures[6])
		})
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

		t.Run("When converting them should return epoch time with millisecond precision", func(t *testing.T) {
			require.Equal(t, int64(tSeconds*1e3), fixtures[0].(int64))
			require.Equal(t, int64(tSeconds*1e3), fixtures[1].(int64))
			require.Equal(t, int64(tMilliseconds), fixtures[2].(int64))
			require.Equal(t, int64(tMilliseconds), fixtures[3].(int64))
			require.Equal(t, int64(tMilliseconds), fixtures[4].(int64))
			require.Equal(t, int64(tMilliseconds), fixtures[5].(int64))
			require.Nil(t, fixtures[6])
		})
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

		t.Run("When converting them should return epoch time with millisecond precision", func(t *testing.T) {
			require.Equal(t, dt.Unix()*1e3, fixtures[0].(int64))
			require.Equal(t, dt.Unix()*1e3, fixtures[1].(int64))
			require.Nil(t, fixtures[2])
		})
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

		t.Run("When converting them should return epoch time with millisecond precision", func(t *testing.T) {
			require.Equal(t, dt.Unix()*1e3, fixtures[0].(int64))
			require.Equal(t, dt.Unix()*1e3, fixtures[1].(int64))
			require.Nil(t, fixtures[2])
		})
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

		t.Run("When converting them should return epoch time with millisecond precision", func(t *testing.T) {
			require.Equal(t, tMilliseconds, fixtures[0].(float64))
			require.Equal(t, tMilliseconds, fixtures[1].(float64))
			require.Equal(t, tMilliseconds, fixtures[2].(float64))
			require.Equal(t, tMilliseconds, fixtures[3].(float64))
			require.Equal(t, tMilliseconds, fixtures[4].(float64))
			require.Equal(t, tMilliseconds, fixtures[5].(float64))
			require.Nil(t, fixtures[6])
		})
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

		t.Run("When converting them should return epoch time with millisecond precision", func(t *testing.T) {
			require.Equal(t, float64(tSeconds)*1e3, fixtures[0].(float64))
			require.Equal(t, float64(tSeconds)*1e3, fixtures[1].(float64))
			require.Nil(t, fixtures[2])
		})
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

		fixtures := make([]interface{}, 24)
		fixtures[0] = intValue
		fixtures[1] = &intValue
		fixtures[2] = int64Value
		fixtures[3] = &int64Value
		fixtures[4] = int32Value
		fixtures[5] = &int32Value
		fixtures[6] = int16Value
		fixtures[7] = &int16Value
		fixtures[8] = int8Value
		fixtures[9] = &int8Value
		fixtures[10] = float64Value
		fixtures[11] = &float64Value
		fixtures[12] = float32Value
		fixtures[13] = &float32Value
		fixtures[14] = uintValue
		fixtures[15] = &uintValue
		fixtures[16] = uint64Value
		fixtures[17] = &uint64Value
		fixtures[18] = uint32Value
		fixtures[19] = &uint32Value
		fixtures[20] = uint16Value
		fixtures[21] = &uint16Value
		fixtures[22] = uint8Value
		fixtures[23] = &uint8Value

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

		nilPointerFixtures := make([]interface{}, 12)
		nilPointerFixtures[0] = intNilPointer
		nilPointerFixtures[1] = int64NilPointer
		nilPointerFixtures[2] = int32NilPointer
		nilPointerFixtures[3] = int16NilPointer
		nilPointerFixtures[4] = int8NilPointer
		nilPointerFixtures[5] = float64NilPointer
		nilPointerFixtures[6] = float32NilPointer
		nilPointerFixtures[7] = uintNilPointer
		nilPointerFixtures[8] = uint64NilPointer
		nilPointerFixtures[9] = uint32NilPointer
		nilPointerFixtures[10] = uint16NilPointer
		nilPointerFixtures[11] = uint8NilPointer

		t.Run("When converting values to float should return expected value", func(t *testing.T) {
			for _, f := range fixtures {
				value, err := ConvertSqlValueColumnToFloat("col", f)
				require.NoError(t, err)
				require.True(t, value.Valid)
				require.Equal(t, null.FloatFrom(1).Float64, value.Float64)
			}
		})

		t.Run("When converting nil pointer values to float should return expected value", func(t *testing.T) {
			for _, f := range nilPointerFixtures {
				value, err := ConvertSqlValueColumnToFloat("col", f)
				require.NoError(t, err)
				require.False(t, value.Valid)
			}
		})
	})
}
