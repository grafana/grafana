package level_test

import (
	"testing"

	gokitlog "github.com/go-kit/log"
	gokitlevel "github.com/go-kit/log/level"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/level"
	"github.com/stretchr/testify/require"
)

func TestNewFilter(t *testing.T) {
	newFilteredLoggerScenario(t, "Given all levels is allowed should log all messages", level.AllowAll(), func(t *testing.T, ctx *scenarioContext) {
		logTestMessages(t, ctx)

		require.Len(t, ctx.loggedArgs, 8)
		require.Equal(t, "lvl", ctx.loggedArgs[0][2].(string))
		require.Equal(t, "info", ctx.loggedArgs[0][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[1][2].(string))
		require.Equal(t, "warn", ctx.loggedArgs[1][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[2][2].(string))
		require.Equal(t, "eror", ctx.loggedArgs[2][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[3][2].(string))
		require.Equal(t, "dbug", ctx.loggedArgs[3][3].(level.Value).String())

		require.Equal(t, "level", ctx.loggedArgs[4][0].(string))
		require.Equal(t, "info", ctx.loggedArgs[4][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[5][0].(string))
		require.Equal(t, "warn", ctx.loggedArgs[5][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[6][0].(string))
		require.Equal(t, "error", ctx.loggedArgs[6][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[7][0].(string))
		require.Equal(t, "debug", ctx.loggedArgs[7][1].(gokitlevel.Value).String())
	})

	newFilteredLoggerScenario(t, "Given error, warnings, info, debug is allowed should log all messages", level.AllowDebug(), func(t *testing.T, ctx *scenarioContext) {
		logTestMessages(t, ctx)

		require.Len(t, ctx.loggedArgs, 8)
		require.Equal(t, "lvl", ctx.loggedArgs[0][2].(string))
		require.Equal(t, "info", ctx.loggedArgs[0][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[1][2].(string))
		require.Equal(t, "warn", ctx.loggedArgs[1][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[2][2].(string))
		require.Equal(t, "eror", ctx.loggedArgs[2][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[3][2].(string))
		require.Equal(t, "dbug", ctx.loggedArgs[3][3].(level.Value).String())

		require.Equal(t, "level", ctx.loggedArgs[4][0].(string))
		require.Equal(t, "info", ctx.loggedArgs[4][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[5][0].(string))
		require.Equal(t, "warn", ctx.loggedArgs[5][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[6][0].(string))
		require.Equal(t, "error", ctx.loggedArgs[6][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[7][0].(string))
		require.Equal(t, "debug", ctx.loggedArgs[7][1].(gokitlevel.Value).String())
	})

	newFilteredLoggerScenario(t, "Given error, warnings is allowed should log error and warning messages", level.AllowWarn(), func(t *testing.T, ctx *scenarioContext) {
		logTestMessages(t, ctx)

		require.Len(t, ctx.loggedArgs, 4)
		require.Equal(t, "lvl", ctx.loggedArgs[0][2].(string))
		require.Equal(t, "warn", ctx.loggedArgs[0][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[1][2].(string))
		require.Equal(t, "eror", ctx.loggedArgs[1][3].(level.Value).String())

		require.Equal(t, "level", ctx.loggedArgs[2][0].(string))
		require.Equal(t, "warn", ctx.loggedArgs[2][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[3][0].(string))
		require.Equal(t, "error", ctx.loggedArgs[3][1].(gokitlevel.Value).String())
	})

	newFilteredLoggerScenario(t, "Given error allowed should log error messages", level.AllowError(), func(t *testing.T, ctx *scenarioContext) {
		logTestMessages(t, ctx)

		require.Len(t, ctx.loggedArgs, 2)
		require.Equal(t, "lvl", ctx.loggedArgs[0][2].(string))
		require.Equal(t, "eror", ctx.loggedArgs[0][3].(level.Value).String())

		require.Equal(t, "level", ctx.loggedArgs[1][0].(string))
		require.Equal(t, "error", ctx.loggedArgs[1][1].(gokitlevel.Value).String())
	})

	newFilteredLoggerScenario(t, "Given error, warnings, info is allowed should log error, warning and info messages", level.AllowInfo(), func(t *testing.T, ctx *scenarioContext) {
		logTestMessages(t, ctx)

		require.Len(t, ctx.loggedArgs, 6)
		require.Equal(t, "lvl", ctx.loggedArgs[0][2].(string))
		require.Equal(t, "info", ctx.loggedArgs[0][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[1][2].(string))
		require.Equal(t, "warn", ctx.loggedArgs[1][3].(level.Value).String())
		require.Equal(t, "lvl", ctx.loggedArgs[2][2].(string))
		require.Equal(t, "eror", ctx.loggedArgs[2][3].(level.Value).String())

		require.Equal(t, "level", ctx.loggedArgs[3][0].(string))
		require.Equal(t, "info", ctx.loggedArgs[3][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[4][0].(string))
		require.Equal(t, "warn", ctx.loggedArgs[4][1].(gokitlevel.Value).String())
		require.Equal(t, "level", ctx.loggedArgs[5][0].(string))
		require.Equal(t, "error", ctx.loggedArgs[5][1].(gokitlevel.Value).String())
	})

	newFilteredLoggerScenario(t, "Given no levels is allowed should not log any messages", level.AllowNone(), func(t *testing.T, ctx *scenarioContext) {
		logTestMessages(t, ctx)

		require.Len(t, ctx.loggedArgs, 0)
	})
}

func logTestMessages(t *testing.T, ctx *scenarioContext) {
	t.Helper()

	ctx.logger.Info("info msg")
	ctx.logger.Warn("warn msg")
	ctx.logger.Error("error msg")
	ctx.logger.Debug("debug msg")
	err := gokitlevel.Info(ctx.logger).Log("msg", "gokit info msg")
	require.NoError(t, err)
	err = gokitlevel.Warn(ctx.logger).Log("msg", "gokit warn msg")
	require.NoError(t, err)
	err = gokitlevel.Error(ctx.logger).Log("msg", "gokit error msg")
	require.NoError(t, err)
	err = gokitlevel.Debug(ctx.logger).Log("msg", "gokit debug msg")
	require.NoError(t, err)
}

type scenarioContext struct {
	loggedArgs [][]interface{}
	logger     log.Logger
}

func newFilteredLoggerScenario(t *testing.T, desc string, option level.Option, fn func(t *testing.T, ctx *scenarioContext)) {
	t.Helper()

	ctx := &scenarioContext{
		loggedArgs: [][]interface{}{},
	}

	l := gokitlog.LoggerFunc(func(i ...interface{}) error {
		ctx.loggedArgs = append(ctx.loggedArgs, i)
		return nil
	})
	filteredLogger := level.NewFilter(l, option)
	testLogger := log.New("test")
	testLogger.Swap(filteredLogger)

	ctx.logger = testLogger

	t.Run(desc, func(t *testing.T) {
		fn(t, ctx)
	})
}
