package log

import (
	"fmt"
	"testing"
	"time"

	gokitlog "github.com/go-kit/log"
	"github.com/grafana/grafana/pkg/infra/log/level"
	"github.com/stretchr/testify/require"
)

func TestLogger(t *testing.T) {
	t.Run("Root logger should be initialized", func(t *testing.T) {
		require.NotNil(t, root)
		err := root.Log("msg", "hello")
		require.NoError(t, err)
	})

	t.Run("When creating root logger should log as expected", func(t *testing.T) {
		loggedArgs := [][]interface{}{}
		l := gokitlog.LoggerFunc(func(i ...interface{}) error {
			loggedArgs = append(loggedArgs, i)
			return nil
		})

		mockedTime := time.Now()
		origNow := now
		now = func() time.Time {
			return mockedTime
		}
		t.Cleanup(func() {
			now = origNow
		})

		root = newManager(l)
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

		require.Len(t, loggedArgs, 4)
		require.Len(t, loggedArgs[0], 4)
		require.Equal(t, "logger", loggedArgs[0][0].(string))
		require.Equal(t, "one", loggedArgs[0][1].(string))
		require.Equal(t, "msg", loggedArgs[0][2].(string))
		require.Equal(t, "hello 1", loggedArgs[0][3].(string))

		require.Len(t, loggedArgs[1], 4)
		require.Equal(t, "logger", loggedArgs[1][0].(string))
		require.Equal(t, "two", loggedArgs[1][1].(string))
		require.Equal(t, "msg", loggedArgs[1][2].(string))
		require.Equal(t, "hello 2", loggedArgs[1][3].(string))

		require.Len(t, loggedArgs[2], 8)
		require.Equal(t, "logger", loggedArgs[2][0].(string))
		require.Equal(t, "three", loggedArgs[2][1].(string))
		require.Equal(t, "t", loggedArgs[2][2].(string))
		require.Equal(t, mockedTime.Format("2006-01-02T15:04:05.99-0700"), loggedArgs[2][3].(fmt.Stringer).String())
		require.Equal(t, "lvl", loggedArgs[2][4].(string))
		require.Equal(t, level.ErrorValue(), loggedArgs[2][5].(level.Value))
		require.Equal(t, "msg", loggedArgs[2][6].(string))
		require.Equal(t, "hello 3", loggedArgs[2][7].(string))

		require.Len(t, loggedArgs[3], 6)
		require.Equal(t, "logger", loggedArgs[3][0].(string))
		require.Equal(t, "three", loggedArgs[3][1].(string))
		require.Equal(t, "key", loggedArgs[3][2].(string))
		require.Equal(t, "value", loggedArgs[3][3].(string))
		require.Equal(t, "msg", loggedArgs[3][4].(string))
		require.Equal(t, "hello 4", loggedArgs[3][5].(string))

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

			require.Len(t, loggedArgs, 4)
			require.Len(t, swappedLoggedArgs, 7, "expected 4 messages for AllowAll logger and 3 messages for AllowInfo logger")
		})
	})
}
