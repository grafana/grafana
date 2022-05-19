package dashboard

import (
	"fmt"
	"testing"

	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/pkg/encoding/yaml"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/openapi"
)

func TestJSONSchemaValidity(t *testing.T) {
	lin, err := Lineage(cuectx.ProvideThemaLibrary())
	if err != nil {
		t.Fatal(err)
	}
	f, err := openapi.GenerateSchema(thema.SchemaP(lin, thema.SV(0, 0)), nil)
	if err != nil {
		t.Fatal(err)
	}

	// j, err := json.Marshal(cuecontext.New().BuildFile(f))
	// if err != nil {
	// 	t.Fatal(err)
	// }
	//
	// fmt.Println(json.Indent([]byte(j), "", "  "))
	// sl := gojsonschema.NewSchemaLoader()
	// sl.Validate = true
	// sl.Draft = gojsonschema.Draft4
	//
	//
	// if err = sl.AddSchemas(gojsonschema.NewStringLoader(j)); err != nil {
	// 	t.Fatal(err)
	// }
	y, err := yaml.Marshal(cuecontext.New().BuildFile(f))
	if err != nil {
		t.Fatal(err)
	}

	fmt.Println(y)
}
