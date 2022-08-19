package codegen

import (
	"embed"
	"text/template"
	"time"
)

// All the parsed templates in the tmpl subdirectory
var tmpls *template.Template

func init() {
	base := template.New("codegen").Funcs(template.FuncMap{
		"now": time.Now,
	})
	tmpls = template.Must(base.ParseFS(tmplFS, "tmpl/*.tmpl"))
}

//go:embed tmpl/*.tmpl
var tmplFS embed.FS

// The following group of types, beginning with tvars_*, all contain the set
// of variables expected by the corresponding named template file under tmpl/
type (
	tvars_autogen_header struct {
		GeneratorPath  string
		LineagePath    string
		LineageCUEPath string
		GenLicense     bool
	}

	tvars_coremodel_registry struct {
		Coremodels []tplVars
	}

	tvars_addenda struct {
		tplVars
	}

	tvars_coremodel_imports struct {
		PackageName string
	}
)
