package options

import (
	"testing"

	"github.com/spf13/pflag"
	"github.com/stretchr/testify/require"
)

// The multi-tenant apiserver takes its defaults from here, so changing them changes
// behaviour in another repository.
func TestNewExtraOptions_EndpointDefaults(t *testing.T) {
	o := NewExtraOptions()

	require.True(t, o.EnableHybridAPI, "hybrid endpoints should be served by default for opted-in kinds")
	require.False(t, o.EnableKeysAPI, "list-keys endpoints should remain disabled by default")
}

func TestExtraOptions_HybridAPICanBeTurnedOff(t *testing.T) {
	o := NewExtraOptions()
	fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
	o.AddFlags(fs)

	require.NoError(t, fs.Parse([]string{"--grafana-apiserver-enable-hybrid-api=false"}))
	require.False(t, o.EnableHybridAPI)
	require.False(t, o.EnableKeysAPI)
}

func TestExtraOptions_KeysAPICanBeTurnedOn(t *testing.T) {
	o := NewExtraOptions()
	fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
	o.AddFlags(fs)

	require.NoError(t, fs.Parse([]string{"--grafana-apiserver-enable-keys-api=true"}))
	require.True(t, o.EnableKeysAPI)
	require.True(t, o.EnableHybridAPI)
}
