package pfs

import (
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/kindsys"
)

// This is a brick-dumb test that just ensures known schema interfaces are being
// loaded correctly from their declarations in .cue files.
//
// If this test fails, it's either because:
// - They're not being loaded correctly - there's a bug in kindsys or pfs somewhere, fix it
// - The set of schema interfaces has been modified - update the static list here
func TestSchemaInterfacesAreLoaded(t *testing.T) {
	knownSI := []string{"PanelCfg", "DataQuery", "DataSourceCfg"}
	all := kindsys.SchemaInterfaces(nil)
	var loadedSI []string
	for k := range all {
		loadedSI = append(loadedSI, k)
	}

	sort.Strings(knownSI)
	sort.Strings(loadedSI)

	if diff := cmp.Diff(knownSI, loadedSI); diff != "" {
		t.Fatalf("kindsys cue-declared schema interfaces differ from ComposableKinds go struct:\n%s", diff)
	}
}
