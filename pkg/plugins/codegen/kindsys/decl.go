package kindsys

import (
	corekindsys "github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/thema"
)

type PluginDecl struct {
	Slot       *corekindsys.Slot
	Lineage    thema.Lineage
	PluginPath string
	PluginMeta plugindef.PluginDef
}
