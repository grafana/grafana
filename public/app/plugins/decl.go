package plugins

import (
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

type PluginDecl struct {
	Path string
	Tree pfs.Tree
}
