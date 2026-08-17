package serviceaccount

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractPluginNameFromTitle(t *testing.T) {
	require.Equal(t, "test", extractPluginNameFromTitle("extsvc-test"))
	require.Equal(t, "tempo", extractPluginNameFromTitle("extsvc-tempo"))
	require.Empty(t, extractPluginNameFromTitle("regular-service-account"))
}
