package plugindef

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDerivePascal(t *testing.T) {
	table := []struct {
		id, name, out string
	}{
		{
			name: "-- Grafana --",
			out:  "Grafana",
		},
		{
			name: "A weird/Thing",
			out:  "AWeirdThing",
		},
		{
			name: "/",
			out:  "Empty",
		},
		{
			name: "some really Long thing WHY would38883 anyone do this i don't know but hey It seems like it this is just going on and",
			out:  "SomeReallyLongThingWHYWouldAnyoneDoThisIDonTKnowButHeyItSeemsLi",
		},
	}

	for _, row := range table {
		if row.id == "" {
			row.id = "default-empty-panel"
		}

		pd := PluginDef{
			Id:   row.id,
			Name: row.name,
		}

		require.Equal(t, row.out, DerivePascalName(pd))
	}
}
