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

	invalidRawDSJSON := `{ "name": "sloth" }`
	k := newDataSourceJSONKernel(l)
	_, _, err = k.Converge([]byte(invalidRawDSJSON))
	if err == nil {
		t.Fatal(err)
	}

	validRawDSJSON := `{
		"name": "sloth",
		"type": "slothStats",
		"typeLogoUrl": "",
		"access": "",
		"url": "",
		"password": "",
		"user": "",
		"database": "",
		"basicAuth": true,
		"basicAuthUser": "",
		"basicAuthPassword": "",
		"jsonData": null
	}`

	dsInterface, _, err := k.Converge([]byte(validRawDSJSON))
	if err != nil {
		t.Fatal(err)
	}

	if _, ok := dsInterface.(*DataSource); !ok {
		t.Fatalf("could not assert dsInterface of type %t to type Datasource", dsInterface)
	}

}
