package plugindef

import (
	"strings"
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

// DerivePascalName derives a PascalCase name from a PluginDef.
//
// This function does not mutate the input PluginDef; as such, it ignores
// whether there exists any value for PluginDef.PascalName.
//
// FIXME this should be removable once CUE logic for it works/unmarshals correctly.
func DerivePascalName(pd PluginDef) string {
	sani := func(s string) string {
		ret := strings.Title(strings.Map(func(r rune) rune {
			switch {
			case r >= 'a' && r <= 'z':
				return r
			case r >= 'A' && r <= 'Z':
				return r
			default:
				return -1
			}
		}, strings.Title(strings.Map(func(r rune) rune {
			switch r {
			case '-', '_':
				return ' '
			default:
				return r
			}
		}, s))))
		if len(ret) > 63 {
			return ret[:63]
		}
		return ret
	}

	fromname := sani(pd.Name)
	if len(fromname) != 0 {
		return fromname
	}
	return sani(strings.Split(pd.Id, "-")[1])
}
