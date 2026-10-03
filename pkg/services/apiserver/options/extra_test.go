package options

import (
	"testing"

	"github.com/spf13/pflag"
	"github.com/stretchr/testify/require"
)

// The multi-tenant apiserver takes its defaults from here, so changing them changes
// behaviour in another repository.
func TestNewExtraOptions_SearchDefaults(t *testing.T) {
	o := NewExtraOptions()

	require.True(t, o.EnableSearchAPI, "search endpoints should be served by default")
	require.True(t, o.EnableTrashAPI, "trash endpoints should be served by default")
	require.True(t, o.EnableHybridAPI, "hybrid endpoints should be served by default for opted-in kinds")
}

func TestExtraOptions_SearchAPICanBeTurnedOff(t *testing.T) {
	o := NewExtraOptions()
	fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
	o.AddFlags(fs)

	require.NoError(t, fs.Parse([]string{"--grafana-apiserver-enable-search-api=false"}))
	require.False(t, o.EnableSearchAPI)
}

func TestExtraOptions_HybridAPICanBeTurnedOffIndependently(t *testing.T) {
	o := NewExtraOptions()
	fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
	o.AddFlags(fs)

	require.NoError(t, fs.Parse([]string{"--grafana-apiserver-enable-hybrid-api=false"}))
	require.False(t, o.EnableHybridAPI)
	require.True(t, o.EnableSearchAPI)
	require.True(t, o.EnableTrashAPI)
}

func TestExtraOptions_HybridOnly(t *testing.T) {
	o := NewExtraOptions()
	fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
	o.AddFlags(fs)

	require.NoError(t, fs.Parse([]string{
		"--grafana-apiserver-enable-search-api=false",
		"--grafana-apiserver-enable-trash-api=false",
	}))
	require.False(t, o.EnableSearchAPI)
	require.False(t, o.EnableTrashAPI)
	require.True(t, o.EnableHybridAPI)
}
