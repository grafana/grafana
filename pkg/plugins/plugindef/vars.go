package plugindef

import (
	"cuelang.org/go/cue/build"
	"github.com/grafana/grafana/pkg/cuectx"
)

//go:generate go run gen.go

// PkgName is the name of the CUE package that Grafana will load when looking
// for kind declarations by a Grafana plugin.
const PkgName = "grafanaplugin"

func loadInstanceForplugindef() (*build.Instance, error) {
	return cuectx.LoadGrafanaInstance("pkg/plugins/plugindef", "", nil)
}
