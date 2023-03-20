package crd

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsExternallySynced(t *testing.T) {
	require.Equal(t, "g148d11beead6f8ff530eb763", GrafanaUIDToK8sName("XMuLlpZ4k")) // uppercase not OK
	require.Equal(t, "xulipzwk", GrafanaUIDToK8sName("xulipzwk"))                   // lower OK
}
