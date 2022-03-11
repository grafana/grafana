package datasource

import (
	"embed"
	"path/filepath"

	"cuelang.org/go/cue"
	"github.com/grafana/thema"
	"github.com/grafana/thema/kernel"
	"github.com/grafana/thema/load"
)

//go:embed datasource.cue
var cueFS embed.FS

func DatasourceLineage(lib thema.Library, opts ...thema.BindOption) (thema.Lineage, error) {
	linval, err := loadDatasourceLineage(lib)
	if err != nil {
		return nil, err
	}
	return thema.BindLineage(linval, lib, opts...)
}

func loadDatasourceLineage(lib thema.Library) (cue.Value, error) {
	prefix := filepath.FromSlash("internal/components/datasource")
	fs, err := prefixWithGrafanaCUE(prefix, cueFS)
	if err != nil {
		return cue.Value{}, err
	}
	inst, err := load.InstancesWithThema(fs, prefix)

	// Need to trick loading by creating the embedded file and
	// making it look like a module in the root dir.
	if err != nil {
		return cue.Value{}, err
	}

	return lib.Context().BuildInstance(inst), nil
}

var _ thema.LineageFactory = DatasourceLineage

func newDataSourceJSONKernel(lin thema.Lineage) kernel.InputKernel {
	jdk, err := kernel.NewInputKernel(kernel.InputKernelConfig{
		Lineage:     lin,
		Loader:      kernel.NewJSONDecoder("datasource.cue"),
		To:          thema.SV(0, 0),
		TypeFactory: func() interface{} { return &Model{} },
	})
	if err != nil {
		panic(err)
	}
	return jdk
}
