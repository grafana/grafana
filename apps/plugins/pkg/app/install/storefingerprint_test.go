package install

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStoreFingerprint(t *testing.T) {
	a := []PluginInstall{{ID: "a", Version: "1.0.0"}, {ID: "b", Version: "2.0.0"}}
	b := []PluginInstall{{ID: "b", Version: "2.0.0"}, {ID: "a", Version: "1.0.0"}}
	c := []PluginInstall{{ID: "a", Version: "1.0.1"}, {ID: "b", Version: "2.0.0"}}

	require.Equal(t, storeFingerprint(a), storeFingerprint(b), "order must not matter")
	require.NotEqual(t, storeFingerprint(a), storeFingerprint(c), "a version change must change the fingerprint")
	require.NotEqual(t, storeFingerprint(a), storeFingerprint(a[:1]), "a missing plugin must change the fingerprint")
	require.Len(t, storeFingerprint(a), 12)
}
