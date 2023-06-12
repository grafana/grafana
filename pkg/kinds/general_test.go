package kinds

import (
	"testing"

	//"github.com/grafana/grafana/pkg/kinds/playlist"
	"github.com/stretchr/testify/require"
)

func TestConversion(t *testing.T) {
	name := "hello"
	d := GrafanaResource[any, any]{
		Metadata: GrafanaResourceMetadata{
			Name: name,
		},
	}

	a, err := toAnyGrafanaResource(d)
	require.NoError(t, err)
	require.Equal(t, name, a.Metadata.Name)
}
