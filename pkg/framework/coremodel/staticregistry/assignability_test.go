package staticregistry_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/framework/coremodel/staticregistry"
	"github.com/grafana/thema"
)

func TestSchemaAssignability(t *testing.T) {
	reg, err := staticregistry.ProvideRegistry()
	if err != nil {
		t.Fatal(err)
	}

	for _, cm := range reg.List() {
		tcm := cm
		t.Run(tcm.Lineage().Name(), func(t *testing.T) {
			err := thema.AssignableTo(tcm.CurrentSchema(), tcm.GoType())
			if err != nil {
				t.Fatal(err)
			}
		})
	}
}
