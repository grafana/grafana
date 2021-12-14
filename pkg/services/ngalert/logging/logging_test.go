package logging

import (
	"bytes"
	"fmt"
	"io"
	"testing"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/inconshreveable/log15"
	"github.com/stretchr/testify/require"
)

func Test_GoKitWrapper(t *testing.T) {
	getLogger := func(writer io.Writer) log.Logger {
		log15Logger := log15.New()
		log15Logger.SetHandler(log15.StreamHandler(writer, log15.LogfmtFormat()))
		return NewWrapper(log15Logger)
	}

	tests := []struct {
		level         level.Value
		expectedLevel string
	}{
		{
			level.DebugValue(),
			"dbug",
		},
		{
			level.InfoValue(),
			"info",
		},
		{
			level.WarnValue(),
			"warn",
		},
		{
			level.ErrorValue(),
			"eror",
		},
	}
	for _, test := range tests {
		t.Run(fmt.Sprintf("when level %s", test.level.String()), func(t *testing.T) {
			t.Run(fmt.Sprintf("rendered message should contain the level %s", test.expectedLevel), func(t *testing.T) {
				var data bytes.Buffer
				gokitLogger := getLogger(&data)
				_ = log.WithPrefix(gokitLogger, level.Key(), test.level).Log("msg", "test", "some", "more", "context", "data")

				str := data.String()
				require.Contains(t, str, fmt.Sprintf("lvl=%s msg=test some=more context=data", test.expectedLevel))
			})
		})
	}

	t.Run("use info when level does not exist", func(t *testing.T) {
		var data bytes.Buffer
		gokitLogger := getLogger(&data)
		_ = gokitLogger.Log("msg", "test", "some", "more", "context", "data")
		str := data.String()
		require.Contains(t, str, "lvl=info msg=test some=more context=data")
	})
	t.Run("use empty msg when context misses msg", func(t *testing.T) {
		var data bytes.Buffer
		gokitLogger := getLogger(&data)
		_ = gokitLogger.Log("message", "test", "some", "more", "context", "data")
		str := data.String()
		require.Contains(t, str, "lvl=info msg= message=test some=more context=data")
	})
}

func Benchmark_Baseline(t *testing.B) {
	log15Logger := log15.New()
	var buff bytes.Buffer
	log15Logger.SetHandler(log15.StreamHandler(&buff, log15.LogfmtFormat()))

	for i := 0; i < t.N; i++ {
		log15Logger.Info("test", "some", "more", "context", "data")
	}
}

func Benchmark_WrapperLogger(t *testing.B) {
	log15Logger := log15.New()
	var buff bytes.Buffer
	log15Logger.SetHandler(log15.StreamHandler(&buff, log15.LogfmtFormat()))
	gokit := NewWrapper(log15Logger)

	for i := 0; i < t.N; i++ {
		_ = level.Info(gokit).Log("msg", "test", "some", "more", "context", "data")
	}
}

func Benchmark_WrapperWriter(t *testing.B) {
	log15Logger := log15.New()
	var buff bytes.Buffer
	log15Logger.SetHandler(log15.StreamHandler(&buff, log15.LogfmtFormat()))
	gokit := gokit_log.NewLogfmtLogger(NewWrapper(log15Logger))
	for i := 0; i < t.N; i++ {
		_ = level.Info(gokit).Log("msg", "test", "some", "more", "context", "data")
	}
}
