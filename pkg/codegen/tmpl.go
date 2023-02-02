package codegen

import (
	"bytes"
	"embed"
	"text/template"
	"time"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
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
	tvars_gen_header struct {
		MainGenerator string
		Using         []codejen.NamedJenny
		From          string
		Leader        string
	}
	tvars_kind_registry struct {
		PackageName       string
		KindPackagePrefix string
		Kinds             []kindsys.Core
	}
	tvars_coremodel_imports struct {
		PackageName string
	}
)

type HeaderVars = tvars_autogen_header

// GenGrafanaHeader creates standard header elements for generated Grafana files.
func GenGrafanaHeader(vars HeaderVars) string {
	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("autogen_header.tmpl").Execute(buf, vars); err != nil {
		panic(err)
	}
	return buf.String()
}
