package apiserver

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAdminAPIEndpoint(t *testing.T) {
	out, err := readRuntimeConfig("all/all=true,dashboards.grafana.app/v0alpha1=false")
	require.NoError(t, err)
	require.Equal(t, []apiConfig{
		{group: "all", version: "all", enabled: true},
		{group: "dashboards.grafana.app", version: "v0alpha1", enabled: false},
	}, out)
	require.Equal(t, "all/all=true", fmt.Sprintf("%v", out[0]))

	// Empty is an error
	_, err = readRuntimeConfig("")
	require.Error(t, err)
}
