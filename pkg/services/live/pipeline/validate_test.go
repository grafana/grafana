package pipeline

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPatternHash(t *testing.T) {
	require.Equal(t, "/:parameter/*catchall", PatternHash("/:test/*rest"))
	require.Equal(t, "/123/:parameter/*catchall", PatternHash("/123/:test/*rest"))
}

func TestCheckJavascriptValid(t *testing.T) {
	require.Error(t, CheckJavascriptValid("while (true) {}"))
	require.Error(t, CheckJavascriptValid("return 1"))
	require.NoError(t, CheckJavascriptValid("1"))
}

func TestPatternValid(t *testing.T) {
	require.True(t, PatternValid("/test/simple"))
	require.False(t, PatternValid("</test/simple>"))
}
