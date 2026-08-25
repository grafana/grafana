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
}

func TestExtraOptions_SearchAPICanBeTurnedOff(t *testing.T) {
	o := NewExtraOptions()
	fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
	o.AddFlags(fs)

	require.NoError(t, fs.Parse([]string{"--grafana-apiserver-enable-search-api=false"}))
	require.False(t, o.EnableSearchAPI)
}
