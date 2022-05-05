package log

import (
	"testing"

	gokitlog "github.com/go-kit/log"
	"github.com/stretchr/testify/require"
)

func TestCompositeLogger(t *testing.T) {
	loggedArgs := [][]interface{}{}
	l := gokitlog.LoggerFunc(func(i ...interface{}) error {
		loggedArgs = append(loggedArgs, i)
		return nil
	})

	cl := newCompositeLogger(l, l, l)
	require.NotNil(t, cl)

	err := cl.Log("msg", "hello")
	require.NoError(t, err)
	require.Len(t, loggedArgs, 3)
	require.Equal(t, "msg", loggedArgs[0][0].(string))
	require.Equal(t, "hello", loggedArgs[0][1].(string))
}
