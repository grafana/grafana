package util

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsValidCK8sCRDName(t *testing.T) {
	// too long
	require.Equal(t, false, IsValidCK8sCRDName("a123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890"))

	require.Equal(t, false, IsValidCK8sCRDName(""))            // too short
	require.Equal(t, false, IsValidCK8sCRDName("001"))         // numeric first
	require.Equal(t, false, IsValidCK8sCRDName("XMuLlpZ4k"))   // uppercase not OK
	require.Equal(t, false, IsValidCK8sCRDName("-a"))          // can not start with dash
	require.Equal(t, false, IsValidCK8sCRDName("hello/world")) // punctuation
	require.Equal(t, false, IsValidCK8sCRDName("hello?world")) // punctuation
	require.Equal(t, false, IsValidCK8sCRDName("hello world")) // punctuation

	// OK names
	require.Equal(t, true, IsValidCK8sCRDName("hello-world")) // dash is ok
	require.Equal(t, true, IsValidCK8sCRDName("xulipzwk"))    // lower OK
	require.Equal(t, true, IsValidCK8sCRDName("a"))           // lower OK
	require.Equal(t, true, IsValidCK8sCRDName("fe38343c-cfca-49d3-b76e-af0e6add9a2a"))
}

func TestGrafanaUIDToK8sName(t *testing.T) {
	// Invalid names create hash functions
	require.Equal(t, "g7a3e6b16cb75f48fb897eff3", GrafanaUIDToK8sName("001"))
	require.Equal(t, "g148d11beead6f8ff530eb763", GrafanaUIDToK8sName("XMuLlpZ4k"))
	require.Equal(t, "g4b68ab3847feda7d6c62c1fb", GrafanaUIDToK8sName("X"))

	// Valid are used directly
	require.Equal(t, "xulipzwk", GrafanaUIDToK8sName("xulipzwk"))
	require.Equal(t, "a", GrafanaUIDToK8sName("a"))
	require.Equal(t, "fe38343c-cfca-49d3-b76e-af0e6add9a2a", GrafanaUIDToK8sName("fe38343c-cfca-49d3-b76e-af0e6add9a2a"))
}
