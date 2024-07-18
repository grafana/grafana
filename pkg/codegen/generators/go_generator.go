package generators

import (
	"bytes"
	"fmt"
	"go/parser"
	"go/token"
	"path/filepath"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/pkg/encoding/yaml"
	"github.com/dave/dst/decorator"
	"github.com/dave/dst/dstutil"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/oapi-codegen/oapi-codegen/v2/pkg/codegen"
	"golang.org/x/tools/imports"
)

type GoConfig struct {
	Config      *OpenApiConfig
	PackageName string
	ApplyFuncs  []dstutil.ApplyFunc
}

func GenerateTypesGo(v cue.Value, cfg *GoConfig) ([]byte, error) {
	if cfg == nil {
		return nil, fmt.Errorf("configuration cannot be nil")
	}

	applyFuncs := []dstutil.ApplyFunc{depointerizer(), fixRawData(), fixUnderscoreInTypeName(), fixTODOComments()}
	applyFuncs = append(applyFuncs, cfg.ApplyFuncs...)

	f, err := generateOpenAPI(v, cfg.Config)
	if err != nil {
		return nil, err
	}

	str, err := yaml.Marshal(v.Context().BuildFile(f))
	if err != nil {
		return nil, fmt.Errorf("cue-yaml marshaling failed: %w", err)
	}

	loader := openapi3.NewLoader()
	oT, err := loader.LoadFromData([]byte(str))
	if err != nil {
		return nil, fmt.Errorf("loading generated openapi failed: %w", err)
	}

	schemaName, err := getSchemaName(v)
	if err != nil {
		return nil, err
	}

	if cfg.PackageName == "" {
		cfg.PackageName = schemaName
	}

	// Hack to fix https://github.com/grafana/thema/pull/127 issue without importing
	// to avoid to add the whole vendor in Grafana code
	if cfg.PackageName == "dataquery" {
		fixDataQuery(oT)
	}

	ccfg := codegen.Configuration{
		PackageName: cfg.PackageName,
		Compatibility: codegen.CompatibilityOptions{
			AlwaysPrefixEnumValues: true,
		},
		Generate: codegen.GenerateOptions{
			Models: true,
		},
		OutputOptions: codegen.OutputOptions{
			SkipPrune: true,
			UserTemplates: map[string]string{
				"imports.tmpl": importstmpl,
			},
		},
	}

	gostr, err := codegen.Generate(oT, ccfg)
	if err != nil {
		return nil, fmt.Errorf("openapi generation failed: %w", err)
	}

	return postprocessGoFile(genGoFile{
		path:     fmt.Sprintf("%s_type_gen.go", schemaName),
		appliers: applyFuncs,
		in:       []byte(gostr),
	})
}

type genGoFile struct {
	path     string
	appliers []dstutil.ApplyFunc
	in       []byte
}

func postprocessGoFile(cfg genGoFile) ([]byte, error) {
	fname := sanitizeLabelString(filepath.Base(cfg.path))
	buf := new(bytes.Buffer)
	fset := token.NewFileSet()
	gf, err := decorator.ParseFile(fset, fname, string(cfg.in), parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("error parsing generated file: %w", err)
	}

	for _, af := range cfg.appliers {
		dstutil.Apply(gf, af, nil)
	}

	err = decorator.Fprint(buf, gf)
	if err != nil {
		return nil, fmt.Errorf("error formatting generated file: %w", err)
	}

	byt, err := imports.Process(fname, buf.Bytes(), nil)
	if err != nil {
		return nil, fmt.Errorf("goimports processing of generated file failed: %w", err)
	}

	// Compare imports before and after; warn about performance if some were added
	gfa, _ := parser.ParseFile(fset, fname, string(byt), parser.ParseComments)
	imap := make(map[string]bool)
	for _, im := range gf.Imports {
		imap[im.Path.Value] = true
	}
	var added []string
	for _, im := range gfa.Imports {
		if !imap[im.Path.Value] {
			added = append(added, im.Path.Value)
		}
	}

	if len(added) != 0 {
		// TODO improve the guidance in this error if/when we better abstract over imports to generate
		return nil, fmt.Errorf("goimports added the following import statements to %s: \n\t%s\nRelying on goimports to find imports significantly slows down code generation. Either add these imports with an AST manipulation in cfg.ApplyFuncs, or set cfg.IgnoreDiscoveredImports to true", cfg.path, strings.Join(added, "\n\t"))
	}
	return byt, nil
}

// fixDataQuery extends the properties for the AllOf schemas when a DataQuery exists.
// deep/oapi-codegen library ignores the properties of the models and only ones have references.
// It doesn't apply this change https://github.com/grafana/thema/pull/154 since it modifies the
// vendor implementation, and we don't import it.
func fixDataQuery(spec *openapi3.T) *openapi3.T {
	for _, sch := range spec.Components.Schemas {
		if sch.Value != nil && len(sch.Value.AllOf) > 0 {
			for _, allOf := range sch.Value.AllOf {
				for n, p := range allOf.Value.Properties {
					sch.Value.Properties[n] = p
				}
			}
			sch.Value.AllOf = nil
		}
	}
	return spec
}

// Almost all of the below imports are eliminated by dst transformers and calls
// to goimports - but if they're not present in the template, then the internal
// call to goimports that oapi-codegen makes will trigger a search for them,
// which can slow down codegen by orders of magnitude.
var importstmpl = `package {{ .PackageName }}

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"gopkg.in/yaml.v2"
	"io"
	"io/ioutil"
	"os"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/oapi-codegen/runtime"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/go-chi/chi/v5"
	"github.com/labstack/echo/v4"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/mux"
)
`
