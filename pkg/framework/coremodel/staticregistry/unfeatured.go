package staticregistry

import (
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/thema"
)

var emptyLin thema.Lineage

const emptyLinRaw = `
joinSchema: {...}
name: "stub"
seqs: [
	{
		schemas: [
			{...}
		]
	}
]
`

func init() {
	// Calling this directly circumvents wire providers, but it's fine for shim code
	// that only happens with a feature flag disabled.
	lib := cuectx.ProvideThemaLibrary()

	var err error
	emptyLin, err = thema.BindLineage(lib.Context().CompileString(emptyLinRaw), lib)
	if err != nil {
		// Only error scenario is glaring, static bug in code. Not recoverable
		panic(err)
	}
}

type registryProvider func(cm ...coremodel.Interface) (*coremodel.Registry, error)

// Provides a registry full of no-op stub coremodels for each coremodel called
// provided as an arg.
func provideStub(cmsl ...coremodel.Interface) (*coremodel.Registry, error) {
	all := make([]coremodel.Interface, 0, len(cmsl))

	for _, cm := range cmsl {
		all = append(all, emptyCoremodel{
			lin: lineageStub{
				Lineage: emptyLin,
				name:    cm.Lineage().Name(),
			},
		})
	}

	// Real registry, but full of stubbed coremodels
	return coremodel.NewRegistry(all...)
}

type emptyCoremodel struct {
	lin lineageStub
}

type lineageStub struct {
	thema.Lineage
	name string
}

// dummyStruct exists solely to provide a Go type that's returned from the empty
// coremodel, which is used when the coremodel feature flag is toggled off.
//
// Obviously won't actually work to receive/decode real data.
type dummyStruct struct{}

func (l lineageStub) Name() string {
	return l.name
}

func (cm emptyCoremodel) Lineage() thema.Lineage {
	return cm.lin
}

func (cm emptyCoremodel) CurrentSchema() thema.Schema {
	sch, _ := cm.lin.Schema(thema.SV(0, 0))
	return sch
}

func (cm emptyCoremodel) GoType() interface{} {
	return &dummyStruct{}
}
