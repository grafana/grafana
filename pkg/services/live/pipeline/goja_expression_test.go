package pipeline

import (
	"testing"

	"github.com/dop251/goja"
	"github.com/stretchr/testify/require"
)

func TestGojaGetBool(t *testing.T) {
	r, err := getRuntime([]byte(`{"ax": true}`))
	require.NoError(t, err)
	val, err := r.getBool("x.ax")
	require.NoError(t, err)
	require.True(t, val)
}

func TestGojaGetFloat64(t *testing.T) {
	r, err := getRuntime([]byte(`{"ax": 3}`))
	require.NoError(t, err)
	val, err := r.getFloat64("x.ax")
	require.NoError(t, err)
	require.Equal(t, 3.0, val)
}

func TestGojaGetString(t *testing.T) {
	r, err := getRuntime([]byte(`{"ax": "test"}`))
	require.NoError(t, err)
	val, err := r.getString("x.ax")
	require.NoError(t, err)
	require.Equal(t, "test", val)
}

func TestGojaInvalidReturnValue(t *testing.T) {
	r, err := getRuntime([]byte(`{"ax": "test"}`))
	require.NoError(t, err)
	_, err = r.getBool("x.ax")
	require.Error(t, err)
}

func TestGojaIInterrupt(t *testing.T) {
	r, err := getRuntime([]byte(`{}`))
	require.NoError(t, err)
	_, err = r.getBool("while (true) {}")
	var interrupted *goja.InterruptedError
	require.ErrorAs(t, err, &interrupted)
}

func TestGojaIMaxStack(t *testing.T) {
	r, err := getRuntime([]byte(`{}`))
	require.NoError(t, err)
	_, err = r.getBool("function test() {test()}; test();")
	// TODO: strange <nil> error returned here, need to investigate what is it.
	require.Error(t, err)
}
