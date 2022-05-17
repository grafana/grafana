// go:build ignore
//go:build ignore
// +build ignore

package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing/fstest"
	"text/template"

	"cuelang.org/go/cue/cuecontext"
	cueformat "cuelang.org/go/cue/format"
	"cuelang.org/go/pkg/encoding/yaml"
	"github.com/deepmap/oapi-codegen/pkg/codegen"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/openapi"
	"golang.org/x/tools/imports"
)

var lib = thema.NewLibrary(cuecontext.New())

const sep = string(filepath.Separator)

// Generate Go and Typescript implementations for all coremodels, and populate the
// coremodel static registry.
func main() {
	if len(os.Args) > 1 {
		fmt.Fprintf(os.Stderr, "coremodel code generator does not currently accept any arguments\n, got %q", os.Args)
		os.Exit(1)
	}

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not get working directory: %s", err)
		os.Exit(1)
	}

	// TODO this binds us to only having coremodels in a single directory. If we need more, compgen is the way
	grootp := strings.Split(cwd, sep)
	groot := filepath.Join(sep, filepath.Join(grootp[:len(grootp)-3]...))

	cmroot := filepath.Join(groot, "pkg", "coremodel")
	// tsroot := filepath.Join(groot, "packages", "grafana-schema", "src", "coremodel")

	items, err := ioutil.ReadDir(cmroot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not read coremodels parent dir %s: %s\n", cmroot, err)
		os.Exit(1)
	}

	var lins []linsrc
	for _, item := range items {
		if item.IsDir() {
			lin, err := processCoremodelDir(filepath.Join(cmroot, item.Name()))
			if err != nil {
				fmt.Fprintf(os.Stderr, "could not process coremodels dir %s: %s\n", cmroot, err)
				os.Exit(1)
			}

			lin.relpath = filepath.Join(strings.Split(lin.path, sep)[len(grootp)-3:]...)
			lins = append(lins, lin)
		}
	}

	for _, ls := range lins {
		err = generateGo(filepath.Join(cmroot, ls.lin.Name()), ls)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to generate Go code for %s: %s\n", ls.lin.Name(), err)
			os.Exit(1)
		}
		// err = generateTypescript(filepath.Join(tsroot, ls.lin.Name()), ls)
		// if err != nil {
		// 	fmt.Fprintf(os.Stderr, "failed to generate Go code for %s: %s\n", ls.lin.Name(), err)
		// 	os.Exit(1)
		// }
	}
}

// Scan the dir and load up its lineage
func processCoremodelDir(path string) (ls linsrc, err error) {
	ls.path = filepath.Join(path, "lineage.cue")
	f, err := os.Open(ls.path)
	if err != nil {
		return ls, fmt.Errorf("could not open lineage file under %s: %w", path, err)
	}

	byt, err := ioutil.ReadAll(f)
	if err != nil {
		return
	}

	fs := fstest.MapFS{
		"lineage.cue": &fstest.MapFile{
			Data: byt,
		},
	}

	_, name := filepath.Split(path)
	ls.lin, err = cuectx.LoadGrafanaInstancesWithThema(filepath.Join("pkg", "coremodel", name), fs, lib)
	if err != nil {
		return
	}
	return
}

type linsrc struct {
	lin     thema.Lineage
	path    string
	relpath string
}

// func getCoremodels() map[string]coremodel.Interface {
//
// 	dash, err := dashboard.ProvideCoremodel(lib)
// 	if err != nil {
// 		panic(err)
// 	}
// 	return map[string]coremodel.Interface{
// 		"dashboard": dash,
// 	}
// }

func generateGo(path string, ls linsrc) error {
	lin := ls.lin
	sch := thema.SchemaP(lin, thema.LatestVersion(lin))
	f, err := openapi.GenerateSchema(sch, nil)
	if err != nil {
		return fmt.Errorf("thema openapi generation failed: %w", err)
	}

	b, err := cueformat.Node(f)
	if err != nil {
		return fmt.Errorf("cue format printing failed: %w", err)
	}

	_ = b

	str, err := yaml.Marshal(lib.Context().BuildFile(f))
	if err != nil {
		return fmt.Errorf("cue-yaml marshaling failed: %w", err)
	}

	loader := openapi3.NewLoader()
	oT, err := loader.LoadFromData([]byte(str))

	gostr, err := codegen.Generate(oT, lin.Name(), codegen.Options{
		GenerateTypes: true,
		SkipPrune:     true,
		SkipFmt:       true,
		UserTemplates: map[string]string{
			"imports.tmpl": fmt.Sprintf(tmplImports, ls.relpath),
		},
	})
	if err != nil {
		return fmt.Errorf("openapi generation failed: %w", err)
	}

	vars := goPkg{
		Name:        lin.Name(),
		LineagePath: ls.relpath,
		LatestSeqv:  sch.Version()[0],
		LatestSchv:  sch.Version()[1],
	}
	var buuf bytes.Buffer
	err = tmplAddenda.Execute(&buuf, vars)
	if err != nil {
		panic(err)
	}

	fset := token.NewFileSet()
	gf, err := parser.ParseFile(fset, "coremodel_gen.go", gostr+buuf.String(), parser.ParseComments)
	if err != nil {
		return fmt.Errorf("generated go file parsing failed: %w", err)
	}
	m := makeReplacer(lin.Name())
	ast.Walk(m, gf)

	var buf bytes.Buffer
	err = format.Node(&buf, fset, gf)
	if err != nil {
		return fmt.Errorf("ast printing failed: %w", err)
	}

	byt, err := imports.Process("coremodel_gen.go", buf.Bytes(), nil)
	if err != nil {
		return fmt.Errorf("goimports processing failed: %w", err)
	}

	err = ioutil.WriteFile(filepath.Join(path, "coremodel_gen.go"), byt, 0644)
	if err != nil {
		return fmt.Errorf("error writing generated code to file: %s", err)
	}

	// Generate the assignability test. TODO do this in a framework test instead
	var buf3 bytes.Buffer
	err = tmplAssignableTest.Execute(&buf3, vars)
	if err != nil {
		return fmt.Errorf("failed generating assignability test file: %w", err)
	}

	err = ioutil.WriteFile(filepath.Join(path, "coremodel_gen_test.go"), buf3.Bytes(), 0644)
	if err != nil {
		return fmt.Errorf("error writing generated test code to file: %s", err)
	}

	return nil
}

func makeReplacer(name string) modelReplacer {
	return modelReplacer(fmt.Sprintf("%s%s", string(strings.ToUpper(name)[0]), name[1:]))
}

type modelReplacer string

func (m modelReplacer) Visit(n ast.Node) ast.Visitor {
	switch x := n.(type) {
	case *ast.Ident:
		x.Name = m.replacePrefix(x.Name)
	}
	return m
}

func (m modelReplacer) replacePrefix(str string) string {
	if len(str) >= len(m) && str[:len(m)] == string(m) {
		return strings.Replace(str, string(m), "Model", 1)
	}
	return str
}

func generateTypescript(path string, ls linsrc) error {
	panic("TODO")
}

type goPkg struct {
	Name                   string
	LineagePath            string
	LatestSeqv, LatestSchv uint
	IsComposed             bool
}

var tmplImports = `// This file is autogenerated. DO NOT EDIT.
//
// Derived from the coremodel Thema lineage at %s

package {{ .PackageName }}

import (
	"embed"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/deepmap/oapi-codegen/pkg/runtime"
	openapi_types "github.com/deepmap/oapi-codegen/pkg/types"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/grafana/thema"
	"github.com/grafana/grafana/pkg/cuectx"
)
`

var tmplAddenda = template.Must(template.New("addenda").Parse(`
var (
	//go:embed lineage.cue
	cueFS embed.FS

	// codegen ensures that this is always the latest Thema schema version
	currentVersion = thema.SV({{ .LatestSeqv }}, {{ .LatestSchv }})
)

// Lineage returns the Thema lineage representing a Grafana {{ .Name }}.
//
// The lineage is the canonical specification of the current {{ .Name }} schema,
// all prior schema versions, and the mappings that allow migration between
// schema versions.
{{- if .IsComposed }}//
// This is the base variant of the schema. It does not include any composed
// plugin schemas.{{ end }}
func Lineage(lib thema.Library, opts ...thema.BindOption) (thema.Lineage, error) {
	return cuectx.LoadGrafanaInstancesWithThema(filepath.Join("pkg", "coremodel", "dashboard"), cueFS, lib, opts...)
}

var _ thema.LineageFactory = Lineage

// Coremodel contains the foundational schema declaration for {{ .Name }}s.
type Coremodel struct {
	lin thema.Lineage
}

// Lineage returns the canonical dashboard Lineage.
func (c *Coremodel) Lineage() thema.Lineage {
	return c.lin
}

// CurrentSchema returns the current (latest) {{ .Name }} Thema schema.
func (c *Coremodel) CurrentSchema() thema.Schema {
	return thema.SchemaP(c.lin, currentVersion)
}

// GoType returns a pointer to an empty Go struct that corresponds to
// the current Thema schema.
func (c *Coremodel) GoType() interface{} {
	return &Model{}
}

func ProvideCoremodel(lib thema.Library) (*Coremodel, error) {
	lin, err := Lineage(lib)
	if err != nil {
		return nil, err
	}

	return &Coremodel{
		lin: lin,
	}, nil
}
`))

var tmplAssignableTest = template.Must(template.New("addenda").Parse(`// This file is autogenerated. DO NOT EDIT.
//
// Derived from the coremodel Thema lineage at {{ .LineagePath }}

package {{ .Name }}

import (
	"testing"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
)

func TestSchemaAssignability(t *testing.T) {
	lin, err := Lineage(cuectx.ProvideThemaLibrary())
	if err != nil {
		t.Fatal(err)
	}

	sch := thema.SchemaP(lin, currentVersion)

	err = thema.AssignableTo(sch, &Model{})
	if err != nil {
		t.Fatal(err)
	}
}
`))
