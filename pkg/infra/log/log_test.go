package log

import (
	"context"
	"fmt"
	"testing"
	"time"

	gokitlog "github.com/go-kit/log"
	"github.com/stretchr/testify/require"

	"github.com/go-kit/log/level"
	"github.com/grafana/grafana/pkg/util"
)

func TestLogger(t *testing.T) {
	t.Run("Root logger should be initialized", func(t *testing.T) {
		require.NotNil(t, root)
		err := root.Log("msg", "hello")
		require.NoError(t, err)
	})

	newLoggerScenario(t, "When creating root logger should log as expected", func(t *testing.T, ctx *scenarioContext) {
		log1 := New("one")
		err := log1.Log("msg", "hello 1")
		require.NoError(t, err)
		log2 := New("two")
		err = log2.Log("msg", "hello 2")
		require.NoError(t, err)
		log3 := New("three")
		log3.Error("hello 3")
		log4 := log3.New("key", "value")
		err = log4.Log("msg", "hello 4")
		require.NoError(t, err)
		log3.Error("hello 3 again")

		require.Len(t, ctx.loggedArgs, 5)
		require.Len(t, ctx.loggedArgs[0], 6)
		require.Equal(t, "logger", ctx.loggedArgs[0][0].(string))
		require.Equal(t, "one", ctx.loggedArgs[0][1].(string))
		require.Equal(t, "t", ctx.loggedArgs[0][2].(string))
		require.Equal(t, ctx.mockedTime.Format(time.RFC3339Nano), ctx.loggedArgs[0][3].(fmt.Stringer).String())
		require.Equal(t, "msg", ctx.loggedArgs[0][4].(string))
		require.Equal(t, "hello 1", ctx.loggedArgs[0][5].(string))

		require.Len(t, ctx.loggedArgs[1], 6)
		require.Equal(t, "logger", ctx.loggedArgs[1][0].(string))
		require.Equal(t, "two", ctx.loggedArgs[1][1].(string))
		require.Equal(t, "t", ctx.loggedArgs[0][2].(string))
		require.Equal(t, ctx.mockedTime.Format(time.RFC3339Nano), ctx.loggedArgs[0][3].(fmt.Stringer).String())
		require.Equal(t, "msg", ctx.loggedArgs[1][4].(string))
		require.Equal(t, "hello 2", ctx.loggedArgs[1][5].(string))

		require.Len(t, ctx.loggedArgs[2], 8)
		require.Equal(t, "logger", ctx.loggedArgs[2][0].(string))
		require.Equal(t, "three", ctx.loggedArgs[2][1].(string))
		require.Equal(t, "t", ctx.loggedArgs[2][2].(string))
		require.Equal(t, ctx.mockedTime.Format(time.RFC3339Nano), ctx.loggedArgs[2][3].(fmt.Stringer).String())
		require.Equal(t, level.Key().(string), ctx.loggedArgs[2][4].(string))
		require.Equal(t, level.ErrorValue(), ctx.loggedArgs[2][5].(level.Value))
		require.Equal(t, "msg", ctx.loggedArgs[2][6].(string))
		require.Equal(t, "hello 3", ctx.loggedArgs[2][7].(string))

		require.Len(t, ctx.loggedArgs[3], 8)
		require.Equal(t, "logger", ctx.loggedArgs[3][0].(string))
		require.Equal(t, "three", ctx.loggedArgs[3][1].(string))
		require.Equal(t, "key", ctx.loggedArgs[3][2].(string))
		require.Equal(t, "value", ctx.loggedArgs[3][3].(string))
		require.Equal(t, "t", ctx.loggedArgs[3][4].(string))
		require.Equal(t, ctx.mockedTime.Format(time.RFC3339Nano), ctx.loggedArgs[3][5].(fmt.Stringer).String())
		require.Equal(t, "msg", ctx.loggedArgs[3][6].(string))
		require.Equal(t, "hello 4", ctx.loggedArgs[3][7].(string))

		require.Len(t, ctx.loggedArgs[4], 8)
		require.Equal(t, "logger", ctx.loggedArgs[4][0].(string))
		require.Equal(t, "three", ctx.loggedArgs[4][1].(string))
		require.Equal(t, "t", ctx.loggedArgs[4][2].(string))
		require.Equal(t, ctx.mockedTime.Format(time.RFC3339Nano), ctx.loggedArgs[4][3].(fmt.Stringer).String())
		require.Equal(t, level.Key().(string), ctx.loggedArgs[4][4].(string))
		require.Equal(t, level.ErrorValue(), ctx.loggedArgs[4][5].(level.Value))
		require.Equal(t, "msg", ctx.loggedArgs[4][6].(string))
		require.Equal(t, "hello 3 again", ctx.loggedArgs[4][7].(string))

		t.Run("When initializing root logger should swap loggers as expected", func(t *testing.T) {
			swappedLoggedArgs := [][]interface{}{}
			swapLogger := gokitlog.LoggerFunc(func(i ...interface{}) error {
				swappedLoggedArgs = append(swappedLoggedArgs, i)
				return nil
			})

			root.initialize([]logWithFilters{
				{
					val:      swapLogger,
					maxLevel: level.AllowInfo(),
				},
				{
					val:      swapLogger,
					maxLevel: level.AllowAll(),
				},
			})

			err := log1.Log("msg", "hello 1")
			require.NoError(t, err)
			err = log2.Log("msg", "hello 2")
			require.NoError(t, err)
			log3.Error("hello 3")
			log3.Debug("debug")

			require.Len(t, ctx.loggedArgs, 5)
			require.Len(t, swappedLoggedArgs, 7, "expected 4 messages for AllowAll logger and 3 messages for AllowInfo logger")
		})
	})

	newLoggerScenario(t, "Logger with contextual arguments", func(t *testing.T, sCtx *scenarioContext) {
		ctx := context.Background()
		rootLogger := New("root")
		rootLoggerCtx := rootLogger.FromContext(ctx)
		rootLoggerCtx.Debug("hello root")
		childLogger := rootLogger.New("childKey", "childValue")
		childLoggerCtx := childLogger.FromContext(ctx)
		childLoggerCtx.Error("hello child")

		RegisterContextualLogProvider(func(ctx context.Context) ([]interface{}, bool) {
			return []interface{}{"ctxKey", "ctxValue"}, true
		})

		rootLoggerCtx = rootLogger.FromContext(ctx)
		rootLoggerCtx.Debug("hello contextual root")
		childLoggerCtx = childLogger.FromContext(ctx)
		childLoggerCtx.Error("hello contextual child")

		newRootLogger := New("root")
		newRootLogger.Debug("hello root")

		require.Len(t, sCtx.loggedArgs, 5)
		require.Len(t, sCtx.loggedArgs[0], 8)
		require.Equal(t, "logger", sCtx.loggedArgs[0][0].(string))
		require.Equal(t, "root", sCtx.loggedArgs[0][1].(string))
		require.Equal(t, "t", sCtx.loggedArgs[0][2].(string))
		require.Equal(t, sCtx.mockedTime.Format(time.RFC3339Nano), sCtx.loggedArgs[0][3].(fmt.Stringer).String())
		require.Equal(t, level.Key().(string), sCtx.loggedArgs[0][4].(string))
		require.Equal(t, level.DebugValue(), sCtx.loggedArgs[0][5].(level.Value))
		require.Equal(t, "msg", sCtx.loggedArgs[0][6].(string))
		require.Equal(t, "hello root", sCtx.loggedArgs[0][7].(string))

		require.Len(t, sCtx.loggedArgs[1], 10)
		require.Equal(t, "logger", sCtx.loggedArgs[1][0].(string))
		require.Equal(t, "root", sCtx.loggedArgs[1][1].(string))
		require.Equal(t, "childKey", sCtx.loggedArgs[1][2].(string))
		require.Equal(t, "childValue", sCtx.loggedArgs[1][3].(string))
		require.Equal(t, "t", sCtx.loggedArgs[1][4].(string))
		require.Equal(t, sCtx.mockedTime.Format(time.RFC3339Nano), sCtx.loggedArgs[1][5].(fmt.Stringer).String())
		require.Equal(t, level.Key().(string), sCtx.loggedArgs[1][6].(string))
		require.Equal(t, level.ErrorValue(), sCtx.loggedArgs[1][7].(level.Value))
		require.Equal(t, "msg", sCtx.loggedArgs[1][8].(string))
		require.Equal(t, "hello child", sCtx.loggedArgs[1][9].(string))

		require.Len(t, sCtx.loggedArgs[2], 10)
		require.Equal(t, "logger", sCtx.loggedArgs[2][0].(string))
		require.Equal(t, "root", sCtx.loggedArgs[2][1].(string))
		require.Equal(t, "ctxKey", sCtx.loggedArgs[2][2].(string))
		require.Equal(t, "ctxValue", sCtx.loggedArgs[2][3].(string))
		require.Equal(t, "t", sCtx.loggedArgs[2][4].(string))
		require.Equal(t, sCtx.mockedTime.Format(time.RFC3339Nano), sCtx.loggedArgs[2][5].(fmt.Stringer).String())
		require.Equal(t, level.Key().(string), sCtx.loggedArgs[2][6].(string))
		require.Equal(t, level.DebugValue(), sCtx.loggedArgs[2][7].(level.Value))
		require.Equal(t, "msg", sCtx.loggedArgs[2][8].(string))
		require.Equal(t, "hello contextual root", sCtx.loggedArgs[2][9].(string))

		require.Len(t, sCtx.loggedArgs[3], 12)
		require.Equal(t, "logger", sCtx.loggedArgs[3][0].(string))
		require.Equal(t, "root", sCtx.loggedArgs[3][1].(string))
		require.Equal(t, "childKey", sCtx.loggedArgs[3][2].(string))
		require.Equal(t, "childValue", sCtx.loggedArgs[3][3].(string))
		require.Equal(t, "ctxKey", sCtx.loggedArgs[3][4].(string))
		require.Equal(t, "ctxValue", sCtx.loggedArgs[3][5].(string))
		require.Equal(t, "t", sCtx.loggedArgs[3][6].(string))
		require.Equal(t, sCtx.mockedTime.Format(time.RFC3339Nano), sCtx.loggedArgs[3][7].(fmt.Stringer).String())
		require.Equal(t, level.Key().(string), sCtx.loggedArgs[3][8].(string))
		require.Equal(t, level.ErrorValue(), sCtx.loggedArgs[3][9].(level.Value))
		require.Equal(t, "msg", sCtx.loggedArgs[3][10].(string))
		require.Equal(t, "hello contextual child", sCtx.loggedArgs[3][11].(string))

		require.Len(t, sCtx.loggedArgs[4], 8)
	})
}

func TestWithPrefix(t *testing.T) {
	newLoggerScenario(t, "WithPrefix should prepend context to beginning of log message", func(t *testing.T, ctx *scenarioContext) {
		ls := WithPrefix(New("test"), "k1", "v1")
		ls.Info("hello", "k2", "v2")
		require.Len(t, ctx.loggedArgs, 1)
		require.Len(t, ctx.loggedArgs[0], 12)

		args := ctx.loggedArgs[0]
		require.Equal(t, "logger", args[0].(string))
		require.Equal(t, "test", args[1].(string))
		require.Equal(t, "k1", args[2].(string))
		require.Equal(t, "v1", args[3].(string))
		require.Equal(t, "t", args[4].(string))
		require.Equal(t, ctx.mockedTime.Format(time.RFC3339Nano), args[5].(fmt.Stringer).String())
		require.Equal(t, level.Key().(string), args[6].(string))
		require.Equal(t, level.InfoValue(), args[7].(level.Value))
		require.Equal(t, "msg", args[8].(string))
		require.Equal(t, "hello", args[9].(string))
		require.Equal(t, "k2", args[10].(string))
		require.Equal(t, "v2", args[11].(string))
	})
}

func TestWithSuffix(t *testing.T) {
	newLoggerScenario(t, "WithSuffix should append context to end of log message", func(t *testing.T, ctx *scenarioContext) {
		ls := WithSuffix(New("test"), "k1", "v1")
		ls.Info("hello", "k2", "v2")
		require.Len(t, ctx.loggedArgs, 1)
		require.Len(t, ctx.loggedArgs[0], 12)

		args := ctx.loggedArgs[0]
		require.Equal(t, "logger", args[0].(string))
		require.Equal(t, "test", args[1].(string))
		require.Equal(t, "t", args[2].(string))
		require.Equal(t, ctx.mockedTime.Format(time.RFC3339Nano), args[3].(fmt.Stringer).String())
		require.Equal(t, level.Key().(string), args[4].(string))
		require.Equal(t, level.InfoValue(), args[5].(level.Value))
		require.Equal(t, "msg", args[6].(string))
		require.Equal(t, "hello", args[7].(string))
		require.Equal(t, "k2", args[8].(string))
		require.Equal(t, "v2", args[9].(string))
		require.Equal(t, "k1", args[10].(string))
		require.Equal(t, "v1", args[11].(string))
	})
}

func TestGetFilters(t *testing.T) {
	t.Run("Parsing filters on single line with only space should return expected result", func(t *testing.T) {
		filter := `   `
		filters := getFilters(util.SplitString(filter))
		require.Len(t, filters, 0)
	})

	t.Run("Parsing filters on single line with should return expected result", func(t *testing.T) {
		filter := `rendering:debug oauth.generic_oauth:debug testwithoutlevel provisioning.dashboard:debug`
		filters := getFilters(util.SplitString(filter))
		keys := []string{}
		for k := range filters {
			keys = append(keys, k)
		}

		require.ElementsMatch(t, []string{
			"rendering",
			"oauth.generic_oauth",
			"provisioning.dashboard",
		}, keys)
	})

	t.Run("Parsing filters spread over multiple lines with comments should return expected result", func(t *testing.T) {
		filter := `rendering:debug \
          ; alerting.notifier:debug \
          oauth.generic_oauth:debug \
          ; oauth.okta:debug \
          ; tsdb.postgres:debug \
          ;tsdb.mssql:debug \
          #provisioning.plugins:debug \
          provisioning.dashboard:debug \
          data-proxy-log:debug \
          ;oauthtoken:debug \
          plugins.backend:debug \
          tsdb.elasticsearch.client:debug \
          server:debug \
          tsdb.graphite:debug \
          auth:debug \
          plugin.manager:debug \
          plugin.initializer:debug \
          plugin.loader:debug \
          plugin.finder:debug \
          plugin.installer:debug \
          plugin.signature.validator:debug`
		filters := getFilters(util.SplitString(filter))
		keys := []string{}
		for k := range filters {
			keys = append(keys, k)
		}

		require.ElementsMatch(t, []string{
			"rendering",
			"oauth.generic_oauth",
			"provisioning.dashboard",
			"data-proxy-log",
			"plugins.backend",
			"tsdb.elasticsearch.client",
			"server",
			"tsdb.graphite",
			"auth",
			"plugin.manager",
			"plugin.initializer",
			"plugin.loader",
			"plugin.finder",
			"plugin.installer",
			"plugin.signature.validator",
		}, keys)
	})
}

type scenarioContext struct {
	loggedArgs [][]interface{}
	mockedTime time.Time
}

func newLoggerScenario(t *testing.T, desc string, fn func(t *testing.T, ctx *scenarioContext)) {
	t.Helper()

	ctx := &scenarioContext{
		loggedArgs: [][]interface{}{},
		mockedTime: time.Now(),
	}

	l := gokitlog.LoggerFunc(func(i ...interface{}) error {
		ctx.loggedArgs = append(ctx.loggedArgs, i)
		return nil
	})

	origNow := now
	now = func() time.Time {
		return ctx.mockedTime
	}
	t.Cleanup(func() {
		now = origNow
	})

	origContextHandlers := ctxLogProviders
	ctxLogProviders = []ContextualLogProviderFunc{}
	t.Cleanup(func() {
		ctxLogProviders = origContextHandlers
	})

	root = newManager(l)
	t.Run(desc, func(t *testing.T) {
		fn(t, ctx)
	})
}
