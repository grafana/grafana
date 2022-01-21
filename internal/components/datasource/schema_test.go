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
	_ = l
}
