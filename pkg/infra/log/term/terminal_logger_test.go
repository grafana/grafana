package term

import (
	"bytes"
	"testing"

	"github.com/go-kit/log/level"
	"github.com/stretchr/testify/require"
)

type stringer string

func (s stringer) String() string { return string(s) }

func TestTerminalLoggerFormatsStringerMessages(t *testing.T) {
	var out bytes.Buffer
	logger := NewTerminalLogger(&out)

	require.NoError(t, logger.Log(level.Key(), level.WarnValue(), "msg", stringer("route failed")))
	require.Contains(t, out.String(), "route failed")
}
