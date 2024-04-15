package sqleng

import (
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng/util"
)

func TestSQLEngine(t *testing.T) {
	dt := time.Date(2018, 3, 14, 21, 20, 6, int(527345*time.Microsecond), time.UTC)

	t.Run("Handle interpolating $__interval and $__interval_ms", func(t *testing.T) {
		from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
		to := from.Add(5 * time.Minute)
		timeRange := backend.TimeRange{From: from, To: to}

		text := "$__interval $__timeGroupAlias(time,$__interval) $__interval_ms"

		t.Run("interpolate 10 minutes $__interval", func(t *testing.T) {
			query := backend.DataQuery{JSON: []byte("{}"), MaxDataPoints: 1500, Interval: time.Minute * 10}
			sql := Interpolate(query, timeRange, "", text)
			require.Equal(t, "10m $__timeGroupAlias(time,10m) 600000", sql)
		})

		t.Run("interpolate 4seconds $__interval", func(t *testing.T) {
			query := backend.DataQuery{JSON: []byte("{}"), MaxDataPoints: 1500, Interval: time.Second * 4}
			sql := Interpolate(query, timeRange, "", text)
			require.Equal(t, "4s $__timeGroupAlias(time,4s) 4000", sql)
		})

		t.Run("interpolate 200 milliseconds $__interval", func(t *testing.T) {
			query := backend.DataQuery{JSON: []byte("{}"), MaxDataPoints: 1500, Interval: time.Millisecond * 200}
			sql := Interpolate(query, timeRange, "", text)
			require.Equal(t, "200ms $__timeGroupAlias(time,200ms) 200", sql)
		})
	})

	t.Run("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func(t *testing.T) {
		from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
		to := from.Add(5 * time.Minute)
		timeRange := backend.TimeRange{From: from, To: to}
		query := backend.DataQuery{JSON: []byte("{}"), MaxDataPoints: 1500, Interval: time.Second * 60}

		t.Run("interpolate __unixEpochFrom function", func(t *testing.T) {
			sql := Interpolate(query, timeRange, "", "select $__unixEpochFrom()")
			require.Equal(t, fmt.Sprintf("select %d", from.Unix()), sql)
		})

		t.Run("interpolate __unixEpochTo function", func(t *testing.T) {
			sql := Interpolate(query, timeRange, "", "select $__unixEpochTo()")
			require.Equal(t, fmt.Sprintf("select %d", to.Unix()), sql)
		})
	})

	t.Run("Given row values with int64 as time columns", func(t *testing.T) {
		tSeconds := dt.Unix()
		tMilliseconds := dt.UnixNano() / 1e6
		tNanoSeconds := dt.UnixNano()
		var nilPointer *int64

		originFrame := data.NewFrame("",
			data.NewField("time1", nil, []int64{
				tSeconds,
			}),
			data.NewField("time2", nil, []*int64{
				util.Pointer(tSeconds),
			}),
			data.NewField("time3", nil, []int64{
				tMilliseconds,
			}),
			data.NewField("time4", nil, []*int64{
				util.Pointer(tMilliseconds),
			}),
			data.NewField("time5", nil, []int64{
				tNanoSeconds,
			}),
			data.NewField("time6", nil, []*int64{
				util.Pointer(tNanoSeconds),
			}),
			data.NewField("time7", nil, []*int64{
				nilPointer,
			}),
		)

		for i := 0; i < len(originFrame.Fields); i++ {
			err := convertSQLTimeColumnToEpochMS(originFrame, i)
			require.NoError(t, err)
		}

		require.Equal(t, dt.Unix(), (*originFrame.Fields[0].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[1].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[2].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[3].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[4].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[5].At(0).(*time.Time)).Unix())
		require.Nil(t, originFrame.Fields[6].At(0))
	})

	t.Run("Given row values with uint64 as time columns", func(t *testing.T) {
		tSeconds := uint64(dt.Unix())
		tMilliseconds := uint64(dt.UnixNano() / 1e6)
		tNanoSeconds := uint64(dt.UnixNano())
		var nilPointer *uint64

		originFrame := data.NewFrame("",
			data.NewField("time1", nil, []uint64{
				tSeconds,
			}),
			data.NewField("time2", nil, []*uint64{
				util.Pointer(tSeconds),
			}),
			data.NewField("time3", nil, []uint64{
				tMilliseconds,
			}),
			data.NewField("time4", nil, []*uint64{
				util.Pointer(tMilliseconds),
			}),
			data.NewField("time5", nil, []uint64{
				tNanoSeconds,
			}),
			data.NewField("time6", nil, []*uint64{
				util.Pointer(tNanoSeconds),
			}),
			data.NewField("time7", nil, []*uint64{
				nilPointer,
			}),
		)

		for i := 0; i < len(originFrame.Fields); i++ {
			err := convertSQLTimeColumnToEpochMS(originFrame, i)
			require.NoError(t, err)
		}

		require.Equal(t, dt.Unix(), (*originFrame.Fields[0].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[1].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[2].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[3].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[4].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[5].At(0).(*time.Time)).Unix())
		require.Nil(t, originFrame.Fields[6].At(0))
	})

	t.Run("Given row values with int32 as time columns", func(t *testing.T) {
		tSeconds := int32(dt.Unix())
		var nilInt *int32

		originFrame := data.NewFrame("",
			data.NewField("time1", nil, []int32{
				tSeconds,
			}),
			data.NewField("time2", nil, []*int32{
				util.Pointer(tSeconds),
			}),
			data.NewField("time7", nil, []*int32{
				nilInt,
			}),
		)
		for i := 0; i < 3; i++ {
			err := convertSQLTimeColumnToEpochMS(originFrame, i)
			require.NoError(t, err)
		}

		require.Equal(t, dt.Unix(), (*originFrame.Fields[0].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[1].At(0).(*time.Time)).Unix())
		require.Nil(t, originFrame.Fields[2].At(0))
	})

	t.Run("Given row values with uint32 as time columns", func(t *testing.T) {
		tSeconds := uint32(dt.Unix())
		var nilInt *uint32

		originFrame := data.NewFrame("",
			data.NewField("time1", nil, []uint32{
				tSeconds,
			}),
			data.NewField("time2", nil, []*uint32{
				util.Pointer(tSeconds),
			}),
			data.NewField("time7", nil, []*uint32{
				nilInt,
			}),
		)
		for i := 0; i < len(originFrame.Fields); i++ {
			err := convertSQLTimeColumnToEpochMS(originFrame, i)
			require.NoError(t, err)
		}
		require.Equal(t, dt.Unix(), (*originFrame.Fields[0].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[1].At(0).(*time.Time)).Unix())
		require.Nil(t, originFrame.Fields[2].At(0))
	})

	t.Run("Given row values with float64 as time columns", func(t *testing.T) {
		tSeconds := float64(dt.UnixNano()) / float64(time.Second)
		tMilliseconds := float64(dt.UnixNano()) / float64(time.Millisecond)
		tNanoSeconds := float64(dt.UnixNano())
		var nilPointer *float64

		originFrame := data.NewFrame("",
			data.NewField("time1", nil, []float64{
				tSeconds,
			}),
			data.NewField("time2", nil, []*float64{
				util.Pointer(tSeconds),
			}),
			data.NewField("time3", nil, []float64{
				tMilliseconds,
			}),
			data.NewField("time4", nil, []*float64{
				util.Pointer(tMilliseconds),
			}),
			data.NewField("time5", nil, []float64{
				tNanoSeconds,
			}),
			data.NewField("time6", nil, []*float64{
				util.Pointer(tNanoSeconds),
			}),
			data.NewField("time7", nil, []*float64{
				nilPointer,
			}),
		)

		for i := 0; i < len(originFrame.Fields); i++ {
			err := convertSQLTimeColumnToEpochMS(originFrame, i)
			require.NoError(t, err)
		}

		require.Equal(t, dt.Unix(), (*originFrame.Fields[0].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[1].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[2].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[3].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[4].At(0).(*time.Time)).Unix())
		require.Equal(t, dt.Unix(), (*originFrame.Fields[5].At(0).(*time.Time)).Unix())
		require.Nil(t, originFrame.Fields[6].At(0))
	})

	t.Run("Given row values with float32 as time columns", func(t *testing.T) {
		tSeconds := float32(dt.Unix())
		var nilInt *float32

		originFrame := data.NewFrame("",
			data.NewField("time1", nil, []float32{
				tSeconds,
			}),
			data.NewField("time2", nil, []*float32{
				util.Pointer(tSeconds),
			}),
			data.NewField("time7", nil, []*float32{
				nilInt,
			}),
		)
		for i := 0; i < len(originFrame.Fields); i++ {
			err := convertSQLTimeColumnToEpochMS(originFrame, i)
			require.NoError(t, err)
		}
		require.Equal(t, int64(tSeconds), (*originFrame.Fields[0].At(0).(*time.Time)).Unix())
		require.Equal(t, int64(tSeconds), (*originFrame.Fields[1].At(0).(*time.Time)).Unix())
		require.Nil(t, originFrame.Fields[2].At(0))
	})

	t.Run("Given row with value columns, would be converted to float64", func(t *testing.T) {
		originFrame := data.NewFrame("",
			data.NewField("value1", nil, []int64{
				int64(1),
			}),
			data.NewField("value2", nil, []*int64{
				util.Pointer(int64(1)),
			}),
			data.NewField("value3", nil, []int32{
				int32(1),
			}),
			data.NewField("value4", nil, []*int32{
				util.Pointer(int32(1)),
			}),
			data.NewField("value5", nil, []int16{
				int16(1),
			}),
			data.NewField("value6", nil, []*int16{
				util.Pointer(int16(1)),
			}),
			data.NewField("value7", nil, []int8{
				int8(1),
			}),
			data.NewField("value8", nil, []*int8{
				util.Pointer(int8(1)),
			}),
			data.NewField("value9", nil, []float64{
				float64(1),
			}),
			data.NewField("value10", nil, []*float64{
				util.Pointer(1.0),
			}),
			data.NewField("value11", nil, []float32{
				float32(1),
			}),
			data.NewField("value12", nil, []*float32{
				util.Pointer(float32(1)),
			}),
			data.NewField("value13", nil, []uint64{
				uint64(1),
			}),
			data.NewField("value14", nil, []*uint64{
				util.Pointer(uint64(1)),
			}),
			data.NewField("value15", nil, []uint32{
				uint32(1),
			}),
			data.NewField("value16", nil, []*uint32{
				util.Pointer(uint32(1)),
			}),
			data.NewField("value17", nil, []uint16{
				uint16(1),
			}),
			data.NewField("value18", nil, []*uint16{
				util.Pointer(uint16(1)),
			}),
			data.NewField("value19", nil, []uint8{
				uint8(1),
			}),
			data.NewField("value20", nil, []*uint8{
				util.Pointer(uint8(1)),
			}),
		)
		for i := 0; i < len(originFrame.Fields); i++ {
			_, err := convertSQLValueColumnToFloat(originFrame, i)
			require.NoError(t, err)
			if i == 8 {
				require.Equal(t, float64(1), originFrame.Fields[i].At(0).(float64))
			} else {
				require.NotNil(t, originFrame.Fields[i].At(0).(*float64))
				require.Equal(t, float64(1), *originFrame.Fields[i].At(0).(*float64))
			}
		}
	})

	t.Run("Given row with nil value columns", func(t *testing.T) {
		var int64NilPointer *int64
		var int32NilPointer *int32
		var int16NilPointer *int16
		var int8NilPointer *int8
		var float64NilPointer *float64
		var float32NilPointer *float32
		var uint64NilPointer *uint64
		var uint32NilPointer *uint32
		var uint16NilPointer *uint16
		var uint8NilPointer *uint8

		originFrame := data.NewFrame("",
			data.NewField("value1", nil, []*int64{
				int64NilPointer,
			}),
			data.NewField("value2", nil, []*int32{
				int32NilPointer,
			}),
			data.NewField("value3", nil, []*int16{
				int16NilPointer,
			}),
			data.NewField("value4", nil, []*int8{
				int8NilPointer,
			}),
			data.NewField("value5", nil, []*float64{
				float64NilPointer,
			}),
			data.NewField("value6", nil, []*float32{
				float32NilPointer,
			}),
			data.NewField("value7", nil, []*uint64{
				uint64NilPointer,
			}),
			data.NewField("value8", nil, []*uint32{
				uint32NilPointer,
			}),
			data.NewField("value9", nil, []*uint16{
				uint16NilPointer,
			}),
			data.NewField("value10", nil, []*uint8{
				uint8NilPointer,
			}),
		)
		for i := 0; i < len(originFrame.Fields); i++ {
			t.Run("", func(t *testing.T) {
				_, err := convertSQLValueColumnToFloat(originFrame, i)
				require.NoError(t, err)
				require.Nil(t, originFrame.Fields[i].At(0))
			})
		}
	})

	t.Run("Should not return raw connection errors", func(t *testing.T) {
		err := net.OpError{Op: "Dial", Err: fmt.Errorf("inner-error")}
		transformer := &testQueryResultTransformer{}
		dp := DataSourceHandler{
			log:                    backend.NewLoggerWith("logger", "test"),
			queryResultTransformer: transformer,
		}
		resultErr := dp.TransformQueryError(dp.log, &err)
		assert.False(t, transformer.transformQueryErrorWasCalled)
		errorText := resultErr.Error()
		assert.NotEqual(t, err, resultErr)
		assert.NotContains(t, errorText, "inner-error")
		assert.Contains(t, errorText, "failed to connect to server")
	})

	t.Run("Should return non-connection errors unmodified", func(t *testing.T) {
		err := fmt.Errorf("normal error")
		transformer := &testQueryResultTransformer{}
		dp := DataSourceHandler{
			log:                    backend.NewLoggerWith("logger", "test"),
			queryResultTransformer: transformer,
		}
		resultErr := dp.TransformQueryError(dp.log, err)
		assert.True(t, transformer.transformQueryErrorWasCalled)
		assert.Equal(t, err, resultErr)
		assert.ErrorIs(t, err, resultErr)
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
