package codegen

import (
	"embed"
	"strings"
	"text/template"
	"time"

	"github.com/grafana/codejen"
)

// All the parsed templates in the tmpl subdirectory
var tmpls *template.Template

func init() {
	base := template.New("codegen").Funcs(template.FuncMap{
		"now":     time.Now,
		"ToLower": strings.ToLower,
	})
	tmpls = template.Must(base.ParseFS(tmplFS, "tmpl/*.tmpl"))
}

//go:embed tmpl/*.tmpl
var tmplFS embed.FS

// The following group of types, beginning with tvars_*, all contain the set
// of variables expected by the corresponding named template file under tmpl/
type (
	tvars_gen_header struct {
		MainGenerator string
		Using         []codejen.NamedJenny
		From          string
		Leader        string
	}

	tvars_resource struct {
		PackageName string
		KindName    string
		Version     string
	}

	tvars_metadata struct {
		PackageName string
	}

	tvars_status struct {
		PackageName string
	}

	tvars_registry struct {
		Schemas []Schema
	}

	Schema struct {
		Name     string
		FilePath string
	}
)
