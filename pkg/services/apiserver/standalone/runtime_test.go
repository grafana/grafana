package standalone

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
)

func TestReadRuntimeCOnfig(t *testing.T) {
	out, err := ReadRuntimeConfig("all/all=true," + dashboardV1.APIVERSION + "=false")
	require.NoError(t, err)
	require.Equal(t, []RuntimeConfig{
		{Group: "all", Version: "all", Enabled: true},
		{Group: dashboardV1.GROUP, Version: dashboardV1.VERSION, Enabled: false},
	}, out)
	require.Equal(t, "all/all=true", fmt.Sprintf("%v", out[0]))

	// Empty is an error
	_, err = ReadRuntimeConfig("")
	require.Error(t, err)
}

func TestIsAPIExtensionsEnabled(t *testing.T) {
	runtime, err := ReadRuntimeConfig("query.grafana.app/v0alpha1=true,apiextensions.k8s.io/v1=true")
	require.NoError(t, err)
	require.True(t, IsAPIExtensionsEnabled(runtime))

	runtime, err = ReadRuntimeConfig("query.grafana.app/v0alpha1=true")
	require.NoError(t, err)
	require.False(t, IsAPIExtensionsEnabled(runtime))

	runtime, err = ReadRuntimeConfig("apiextensions.k8s.io/v1=false")
	require.NoError(t, err)
	require.False(t, IsAPIExtensionsEnabled(runtime))
}
