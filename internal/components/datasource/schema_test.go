package datasource

import (
	"testing"

	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/thema"
)

func TestDatasourceLineageIsValid(t *testing.T) {
	l, err := DatasourceLineage(thema.NewLibrary(cuecontext.New()))
	if err != nil {
		t.Fatal(err)
	}

	mockDSRaw := `{ "name": "sloth" }`
	_, _ = l, mockDSRaw
	k := newDataSourceJSONKernel(l)
	dsInterface, _, err := k.Converge([]byte(mockDSRaw))
	if err != nil {
		t.Fatal(err)
	}
	_ = dsInterface
	// Create Datasource object from Rawjson
	// validation (prove invalid)

}
