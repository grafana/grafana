package dashboard

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsExternallySynced(t *testing.T) {
	require.Equal(t, "g148d11beead6f8ff530eb763", GrafanaUIDToK8sName("XMuLlpZ4k")) // uppercase not OK
	require.Equal(t, "xulipzwk", GrafanaUIDToK8sName("xulipzwk"))                   // lower OK
	require.Equal(t, "fe38343c-cfca-49d3-b76e-af0e6add9a2a", GrafanaUIDToK8sName("fe38343c-cfca-49d3-b76e-af0e6add9a2a"))
}
