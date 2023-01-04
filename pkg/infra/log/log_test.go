package log

import (
	"context"
	"fmt"
	"testing"
	"time"

	gokitlog "github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util"
)

func TestLogger(t *testing.T) {
	t.Run("Root logger should be initialized", func(t *testing.T) {
		require.NotNil(t, root)
		err := root.Log("msg", "hello")
		require.NoError(t, err)
	})
}

func TestNew(t *testing.T) {
	scenario := newLoggerScenario(t)

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

	require.Len(t, scenario.loggedArgs, 5, "lines logged")
	scenario.ValidateLineEquality(t, 0, []any{
		"logger", "one",
		"t", scenario.mockedTime,
		"msg", "hello 1",
	})

	scenario.ValidateLineEquality(t, 1, []any{
		"logger", "two",
		"t", scenario.mockedTime,
		"msg", "hello 2",
	})

	scenario.ValidateLineEquality(t, 2, []any{
		"logger", "three",
		"t", scenario.mockedTime,
		level.Key(), level.ErrorValue(),
		"msg", "hello 3",
	})

	scenario.ValidateLineEquality(t, 3, []any{
		"logger", "three",
		"key", "value",
		"t", scenario.mockedTime,
		"msg", "hello 4",
	})

	scenario.ValidateLineEquality(t, 4, []any{
		"logger", "three",
		"t", scenario.mockedTime,
		level.Key(), level.ErrorValue(),
		"msg", "hello 3 again",
	})

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

		require.Len(t, scenario.loggedArgs, 5, "lines logged before swapping logger")
		require.Len(t, swappedLoggedArgs, 7, "expected 4 messages for AllowAll logger and 3 messages for AllowInfo logger")
	})
}

func TestContextualArguments(t *testing.T) {
	scenario := newLoggerScenario(t)
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

	require.Len(t, scenario.loggedArgs, 5)

	baseLog := []any{
		"logger", "root",
		"t", scenario.mockedTime,
		level.Key(), level.DebugValue(),
		"msg", "hello root",
	}
	scenario.ValidateLineEquality(t, 0, baseLog)

	scenario.ValidateLineEquality(t, 1, []any{
		"logger", "root",
		"childKey", "childValue",
		"t", scenario.mockedTime,
		level.Key(), level.ErrorValue(),
		"msg", "hello child",
	})

	require.Len(t, scenario.loggedArgs, 5)
	scenario.ValidateLineEquality(t, 2, []any{
		"logger", "root",
		"ctxKey", "ctxValue",
		"t", scenario.mockedTime,
		level.Key(), level.DebugValue(),
		"msg", "hello contextual root",
	})

	scenario.ValidateLineEquality(t, 3, []any{
		"logger", "root",
		"childKey", "childValue",
		"ctxKey", "ctxValue",
		"t", scenario.mockedTime,
		level.Key(), level.ErrorValue(),
		"msg", "hello contextual child",
	})

	scenario.ValidateLineEquality(t, 4, baseLog)
}

func TestWithPrefix_prependsContext(t *testing.T) {
	scenario := newLoggerScenario(t)
	ls := WithPrefix(New("test"), "k1", "v1")
	ls.Info("hello", "k2", "v2")

	require.Len(t, scenario.loggedArgs, 1)
	scenario.ValidateLineEquality(t, 0, []any{
		"logger", "test",
		"k1", "v1",
		"t", scenario.mockedTime,
		level.Key(), level.InfoValue(),
		"msg", "hello",
		"k2", "v2",
	})
}

func TestWithSuffix_appendsContext(t *testing.T) {
	scenario := newLoggerScenario(t)

	ls := WithSuffix(New("test"), "k1", "v1")
	ls.Info("hello", "k2", "v2")

	require.Len(t, scenario.loggedArgs, 1)
	scenario.ValidateLineEquality(t, 0, []any{
		"logger", "test",
		"t", scenario.mockedTime,
		level.Key(), level.InfoValue(),
		"msg", "hello",
		"k2", "v2",
		"k1", "v1",
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

func (s *scenarioContext) ValidateLineEquality(t testing.TB, n int, expected []any) {
	t.Helper()

	actual := s.loggedArgs[n]
	require.Len(t, actual, len(expected))
	for i := range expected {
		switch ex := expected[i].(type) {
		case time.Time:
			assert.Equal(t, ex.Format(time.RFC3339Nano), actual[i].(fmt.Stringer).String())
		default:
			assert.Equalf(t, ex, actual[i], "line %d argument %d does not match expected value.", n, i)
		}
	}
}

func newLoggerScenario(t testing.TB) *scenarioContext {
	t.Helper()

	scenario := &scenarioContext{
		loggedArgs: [][]interface{}{},
		mockedTime: time.Now(),
	}

	l := gokitlog.LoggerFunc(func(i ...interface{}) error {
		scenario.loggedArgs = append(scenario.loggedArgs, i)
		return nil
	})

	origNow := now
	now = func() time.Time {
		return scenario.mockedTime
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
	return scenario
}
