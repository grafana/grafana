package staticregistry

import (
	"testing"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
)

func TestStubValidates(t *testing.T) {
	// Just check that the stub/empty lineage will accept any (struct) input
	scalarnotwork := []byte(`42`)
	structworks := []byte(`
{
	"whatever": "a value"
}
`)
	structv, err := cuectx.JSONtoCUE("struct", structworks)
	if err != nil {
		t.Fatal(err)
	}
	scalarv, err := cuectx.JSONtoCUE("scalar", scalarnotwork)
	if err != nil {
		t.Fatal(err)
	}

	sch, err := emptyLin.Schema(thema.SV(0, 0))
	if err != nil {
		t.Fatal(err)
	}

	if _, err = sch.Validate(structv); err != nil {
		t.Fatal("struct input should have validated", err)
	}
	if _, err = sch.Validate(scalarv); err == nil {
		t.Fatal("scalar input should have failed validation but passed")
	}
}
