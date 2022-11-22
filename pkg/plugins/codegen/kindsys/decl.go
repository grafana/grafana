package kindsys

import (
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
)

type PluginDecl struct {
	*corecodegen.DeclForGen
	Path       string
	Slot       string
	PluginMeta plugindef.PluginDef
}
