package schema

import (
	_ "embed"

	"github.com/openfga/language/pkg/go/transformer"
)

var (
	//go:embed schema_core.fga
	coreDSL string
	//go:embed schema_folder.fga
	folderDSL string
	//go:embed schema_resource.fga
	resourceDSL string
)

var SchemaModules = []transformer.ModuleFile{
	{
		Name:     "schema_core.fga",
		Contents: coreDSL,
	},
	{
		Name:     "schema_folder.fga",
		Contents: folderDSL,
	},
	{
		Name:     "schema_resource.fga",
		Contents: resourceDSL,
	},
}
