package plugindef

import (
	"sync"

	"cuelang.org/go/cue/build"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
)

//go:generate go run gen.go

func loadInstanceForplugindef() (*build.Instance, error) {
	return cuectx.LoadGrafanaInstance("pkg/plugins/plugindef", "", nil)
}

var linonce sync.Once
var pdlin thema.ConvergentLineage[*PluginDef]
var pdlinerr error

// Lineage returns the [thema.ConvergentLineage] for plugindef, the canonical
// specification for Grafana plugin.json files.
//
// Unless a custom thema.Runtime is specifically needed, prefer calling this with
// nil, as a cached lineage will be returned.
func Lineage(rt *thema.Runtime, opts ...thema.BindOption) (thema.ConvergentLineage[*PluginDef], error) {
	if len(opts) == 0 && (rt == nil || rt == cuectx.GrafanaThemaRuntime()) {
		linonce.Do(func() {
			pdlin, pdlinerr = doLineage(rt)
		})
		return pdlin, pdlinerr
	}
	return doLineage(rt, opts...)
}
