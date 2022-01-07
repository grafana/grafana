package logging

import (
	"bytes"
	"fmt"
	"io"
	"testing"

	"github.com/go-kit/log"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/level"
	"github.com/stretchr/testify/require"
)

func Test_GoKitWrapper(t *testing.T) {
	getLogger := func(writer io.Writer) log.Logger {
		gLogger := glog.New()
		gLogger.AddLogger(log.NewLogfmtLogger(writer), "info", map[string]level.Option{})
		return NewWrapper(gLogger)
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
	gLogger := glog.New()
	var buff bytes.Buffer
	gLogger.AddLogger(log.NewLogfmtLogger(&buff), "info", map[string]level.Option{})

	for i := 0; i < t.N; i++ {
		gLogger.Info("test", "some", "more", "context", "data")
	}
}

func Benchmark_WrapperLogger(t *testing.B) {
	gLogger := glog.New()
	var buff bytes.Buffer
	gLogger.AddLogger(log.NewLogfmtLogger(&buff), "info", map[string]level.Option{})

	gokit := NewWrapper(gLogger)

	for i := 0; i < t.N; i++ {
		_ = level.Info(gokit).Log("msg", "test", "some", "more", "context", "data")
	}
}

func Benchmark_WrapperWriter(t *testing.B) {
	gLogger := glog.New()
	var buff bytes.Buffer
	gLogger.AddLogger(log.NewLogfmtLogger(&buff), "info", map[string]level.Option{})
	gokit := NewWrapper(gLogger)

	for i := 0; i < t.N; i++ {
		_ = level.Info(gokit).Log("msg", "test", "some", "more", "context", "data")
	}
}
