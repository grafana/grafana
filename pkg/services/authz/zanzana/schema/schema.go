package schema

import (
	_ "embed"

	"github.com/openfga/language/pkg/go/transformer"
)

//go:embed core.fga
var coreDSL string

//go:embed dashboard.fga
var dashboardDSL string

//go:embed folder.fga
var folderDSL string

var SchemaModules = []transformer.ModuleFile{
	{
		Name:     "core.fga",
		Contents: coreDSL,
	},
	{
		Name:     "dashboard.fga",
		Contents: dashboardDSL,
	},
	{
		Name:     "folder.fga",
		Contents: folderDSL,
	},
}
