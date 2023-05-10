package util

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsValidK8sName(t *testing.T) {
	// too long
	require.Equal(t, false, IsValidK8sName("a123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890"))

	require.Equal(t, false, IsValidK8sName(""))          // too short
	require.Equal(t, false, IsValidK8sName("001"))       // numeric first
	require.Equal(t, false, IsValidK8sName("XMuLlpZ4k")) // uppercase not OK
	require.Equal(t, false, IsValidK8sName("-a"))        // dash is ok

	// OK names
	require.Equal(t, true, IsValidK8sName("hello-world")) // dash is ok
	require.Equal(t, true, IsValidK8sName("xulipzwk"))    // lower OK
	require.Equal(t, true, IsValidK8sName("a"))           // lower OK
	require.Equal(t, true, IsValidK8sName("fe38343c-cfca-49d3-b76e-af0e6add9a2a"))
}

func TestGrafanaUIDToK8sName(t *testing.T) {
	require.Equal(t, "g7a3e6b16cb75f48fb897eff3", GrafanaUIDToK8sName("001"))       // uppercase not OK
	require.Equal(t, "g148d11beead6f8ff530eb763", GrafanaUIDToK8sName("XMuLlpZ4k")) // uppercase not OK
	require.Equal(t, "xulipzwk", GrafanaUIDToK8sName("xulipzwk"))                   // lower OK
	require.Equal(t, "fe38343c-cfca-49d3-b76e-af0e6add9a2a", GrafanaUIDToK8sName("fe38343c-cfca-49d3-b76e-af0e6add9a2a"))
}
