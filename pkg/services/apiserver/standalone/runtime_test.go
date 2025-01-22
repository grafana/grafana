package standalone

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReadRuntimeCOnfig(t *testing.T) {
	out, err := ReadRuntimeConfig("all/all=true,dashboard.grafana.app/v0alpha1=false")
	require.NoError(t, err)
	require.Equal(t, []RuntimeConfig{
		{Group: "all", Version: "all", Enabled: true},
		{Group: "dashboard.grafana.app", Version: "v0alpha1", Enabled: false},
	}, out)
	require.Equal(t, "all/all=true", fmt.Sprintf("%v", out[0]))

	// Empty is an error
	_, err = ReadRuntimeConfig("")
	require.Error(t, err)
}
