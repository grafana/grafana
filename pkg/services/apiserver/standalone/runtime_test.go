package standalone

import (
	"fmt"
	"testing"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/stretchr/testify/require"
)

func TestReadRuntimeCOnfig(t *testing.T) {
	out, err := ReadRuntimeConfig("all/all=true," + dashboardv1.APIVERSION + "=false")
	require.NoError(t, err)
	require.Equal(t, []RuntimeConfig{
		{Group: "all", Version: "all", Enabled: true},
		{Group: "dashboard.grafana.app", Version: "v1alpha1", Enabled: false},
	}, out)
	require.Equal(t, "all/all=true", fmt.Sprintf("%v", out[0]))

	// Empty is an error
	_, err = ReadRuntimeConfig("")
	require.Error(t, err)
}
