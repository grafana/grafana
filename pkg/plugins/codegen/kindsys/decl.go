package kindsys

import (
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/thema"
)

type PluginDecl struct {
	Slot       string
	Lineage    thema.Lineage
	PluginPath string
	PluginMeta plugindef.PluginDef
}
