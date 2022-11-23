package kindsys

import (
	"cuelang.org/go/cue/ast"
	corekindsys "github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/thema"
)

type PluginDecl struct {
	Slot       *corekindsys.Slot
	Lineage    thema.Lineage
	Imports    []*ast.ImportSpec
	PluginPath string
	PluginMeta plugindef.PluginDef
}
