package datasource

import (
	"testing"

	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/thema"
	"github.com/grafana/thema/kernel"
)

func TestDatasourceLineageIsValid(t *testing.T) {
	ctx := cuecontext.New()
	l, err := DatasourceLineage(thema.NewLibrary(ctx))
	if err != nil {
		t.Fatal(err)
	}

	invalidRawDSJSON := `{ "name": "sloth" }`
	k := newDataSourceJSONKernel(l)
	_, _, err = k.Converge([]byte(invalidRawDSJSON))
	if err == nil {
		t.Fatal(err)
	}

	validRawDSJSON := []byte(`{
		"name": "sloth",
		"type": "slothStats",
		"typeLogoUrl": "",
		"url": "",
		"password": "",
		"user": "",
		"database": "",
		"basicAuth": true,
		"basicAuthUser": "",
		"basicAuthPassword": "",
		"version": 0
	}`)

	sch, _ := l.Schema(thema.SV(0, 0))
	cd, err := kernel.NewJSONDecoder("datasource.cue")(ctx, validRawDSJSON)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sch.Validate(cd)
	if err != nil {
		t.Fatal(err)
	}

	dsInterface, _, err := k.Converge(validRawDSJSON)
	if err != nil {
		t.Fatal(err)
	}

	if _, ok := dsInterface.(*DataSource); !ok {
		t.Fatalf("could not assert dsInterface of type %t to type Datasource", dsInterface)
	}

}
