package vector

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCollectionAllowlist(t *testing.T) {
	a := NewCollectionAllowlist(
		[]string{"dashboard.grafana.app/dashboards", " spaced.group/things "},
		[]string{"ext.example.com/my-things", ""},
	)

	internal := Collection{Group: "dashboard.grafana.app", Resource: "dashboards"}
	require.True(t, a.Allows(internal))
	require.True(t, a.Allows(Collection{Group: "spaced.group", Resource: "things"}), "entries are trimmed")

	external := Collection{Group: "ext.example.com", Resource: "my-things", IsExternal: true}
	require.True(t, a.Allows(external))

	// Internal and external lists don't cross over.
	require.False(t, a.Allows(Collection{Group: "dashboard.grafana.app", Resource: "dashboards", IsExternal: true}))
	require.False(t, a.Allows(Collection{Group: "ext.example.com", Resource: "my-things"}))

	require.False(t, a.Allows(Collection{Group: "unknown", Resource: "nope"}))
	require.False(t, CollectionAllowlist{}.Allows(internal), "zero value allows nothing")
}
