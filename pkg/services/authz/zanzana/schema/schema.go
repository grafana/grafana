package schema

import (
	_ "embed"

	"github.com/openfga/language/pkg/go/transformer"
)

var (
	//go:embed core.fga
	coreDSL string
	//go:embed dashboard.fga
	dashboardDSL string
	//go:embed folder.fga
	folderDSL string
	//go:embed resource.fga
	resourceDSL string
)

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
	{
		Name:     "resource.fga",
		Contents: resourceDSL,
	},
}
