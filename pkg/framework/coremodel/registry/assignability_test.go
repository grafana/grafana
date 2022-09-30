package registry_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/framework/coremodel/registry"
	"github.com/grafana/thema"
)

func TestSchemaAssignability(t *testing.T) {
	reg := registry.NewBase()

	for _, cm := range reg.All() {
		tcm := cm
		t.Run(tcm.Lineage().Name(), func(t *testing.T) {
			err := thema.AssignableTo(tcm.CurrentSchema(), tcm.GoType())
			if err != nil {
				t.Fatal(err)
			}
		})
	}
}
