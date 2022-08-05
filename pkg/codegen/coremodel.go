package codegen

import (
	"bytes"
	"errors"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing/fstest"
	"text/template"

	"cuelang.org/go/pkg/encoding/yaml"
	"github.com/deepmap/oapi-codegen/pkg/codegen"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/grafana/cuetsy"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/openapi"
	"golang.org/x/tools/imports"
)

// ExtractedLineage contains the results of statically analyzing a Grafana
// directory for a Thema lineage.
type ExtractedLineage struct {
	Lineage thema.Lineage
	// Absolute path to the coremodel's coremodel.cue file.
	LineagePath string
	// Path to the coremodel's coremodel.cue file relative to repo root.
	RelativePath string
	// Indicates whether the coremodel is considered canonical or not. Generated
	// code from not-yet-canonical coremodels should include appropriate caveats in
	// documentation and possibly be hidden from external public API surface areas.
	IsCanonical bool
}

// ExtractLineage loads a Grafana Thema lineage from the filesystem.
//
// The provided path must be the absolute path to the file containing the
// lineage to be loaded.
//
// This loading approach is intended primarily for use with code generators, or
// other use cases external to grafana-server backend. For code within
// grafana-server, prefer lineage loaders provided in e.g. pkg/coremodel/*.
func ExtractLineage(path string, lib thema.Library) (*ExtractedLineage, error) {
	if !filepath.IsAbs(path) {
		return nil, fmt.Errorf("must provide an absolute path, got %q", path)
	}

	ec := &ExtractedLineage{
		LineagePath: path,
	}

	var find func(path string) (string, error)
	find = func(path string) (string, error) {
		parent := filepath.Dir(path)
		if parent == path {
			return "", errors.New("grafana root directory could not be found")
		}
		fp := filepath.Join(path, "go.mod")
		if _, err := os.Stat(fp); err == nil {
			return path, nil
		}
		return find(parent)
	}
	groot, err := find(path)
	if err != nil {
		return ec, err
	}

	f, err := os.Open(ec.LineagePath)
	if err != nil {
		return nil, fmt.Errorf("could not open lineage file at %s: %w", path, err)
	}

	byt, err := ioutil.ReadAll(f)
	if err != nil {
		return nil, err
	}

	fs := fstest.MapFS{
		"coremodel.cue": &fstest.MapFile{
			Data: byt,
		},
	}

	ec.RelativePath, err = filepath.Rel(groot, filepath.Dir(path))
	if err != nil {
		// should be unreachable, since we rootclimbed to find groot above
		panic(err)
	}
	ec.Lineage, err = cuectx.LoadGrafanaInstancesWithThema(ec.RelativePath, fs, lib)
	if err != nil {
		return ec, err
	}
	ec.IsCanonical = isCanonical(ec.Lineage.Name())
	return ec, nil
}

// toTemplateObj extracts creates a struct with all the useful strings for template generation.
func (ls *ExtractedLineage) toTemplateObj() tplVars {
	lin := ls.Lineage
	sch := thema.SchemaP(lin, thema.LatestVersion(lin))

	return tplVars{
		Name:        lin.Name(),
		LineagePath: ls.RelativePath,
		PkgPath:     filepath.ToSlash(filepath.Join("github.com/grafana/grafana", ls.RelativePath)),
		TitleName:   strings.Title(lin.Name()), // nolint
		LatestSeqv:  sch.Version()[0],
		LatestSchv:  sch.Version()[1],
	}
}

func isCanonical(name string) bool {
	return canonicalCoremodels[name]
}

// FIXME specifying coremodel canonicality DOES NOT belong here - it should be part of the coremodel declaration.
var canonicalCoremodels = map[string]bool{
	"dashboard": false,
}

// GenerateGoCoremodel generates a standard Go model struct and coremodel
// implementation from a coremodel CUE declaration.
//
// The provided path must be a directory. Generated code files will be written
// to that path. The final element of the path must match the Lineage.Name().
func (ls *ExtractedLineage) GenerateGoCoremodel(path string) (WriteDiffer, error) {
	lin, lib := ls.Lineage, ls.Lineage.Library()
	_, name := filepath.Split(path)
	if name != lin.Name() {
		return nil, fmt.Errorf("lineage name %q must match final element of path, got %q", lin.Name(), path)
	}

	sch := thema.SchemaP(lin, thema.LatestVersion(lin))
	f, err := openapi.GenerateSchema(sch, nil)
	if err != nil {
		return nil, fmt.Errorf("thema openapi generation failed: %w", err)
	}

	str, err := yaml.Marshal(lib.Context().BuildFile(f))
	if err != nil {
		return nil, fmt.Errorf("cue-yaml marshaling failed: %w", err)
	}

	loader := openapi3.NewLoader()
	oT, err := loader.LoadFromData([]byte(str))
	if err != nil {
		return nil, fmt.Errorf("loading generated openapi failed; %w", err)
	}

	gostr, err := codegen.Generate(oT, lin.Name(), codegen.Options{
		GenerateTypes: true,
		SkipPrune:     true,
		SkipFmt:       true,
		UserTemplates: map[string]string{
			"imports.tmpl": fmt.Sprintf(tmplImports, ls.RelativePath),
			"typedef.tmpl": tmplTypedef,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("openapi generation failed: %w", err)
	}

	vars := ls.toTemplateObj()
	var buuf bytes.Buffer
	err = tmplAddenda.Execute(&buuf, vars)
	if err != nil {
		panic(err)
	}

	fset := token.NewFileSet()
	fname := fmt.Sprintf("%s_gen.go", lin.Name())
	gf, err := parser.ParseFile(fset, fname, gostr+buuf.String(), parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("generated go file parsing failed: %w", err)
	}
	m := makeReplacer(lin.Name())
	ast.Walk(m, gf)

	var buf bytes.Buffer
	err = format.Node(&buf, fset, gf)
	if err != nil {
		return nil, fmt.Errorf("ast printing failed: %w", err)
	}

	byt, err := imports.Process(fname, buf.Bytes(), nil)
	if err != nil {
		return nil, fmt.Errorf("goimports processing failed: %w", err)
	}

	wd := NewWriteDiffer()
	wd[filepath.Join(path, fname)] = byt

	return wd, nil
}

type tplVars struct {
	Name                   string
	LineagePath, PkgPath   string
	TitleName              string
	LatestSeqv, LatestSchv uint
	IsComposed             bool
}

func (ls *ExtractedLineage) GenerateTypescriptCoremodel(path string) (WriteDiffer, error) {
	_, name := filepath.Split(path)
	if name != ls.Lineage.Name() {
		return nil, fmt.Errorf("lineage name %q must match final element of path, got %q", ls.Lineage.Name(), path)
	}

	schv := thema.SchemaP(ls.Lineage, thema.LatestVersion(ls.Lineage)).UnwrapCUE()

	parts, err := cuetsy.GenerateAST(schv, cuetsy.Config{})
	if err != nil {
		return nil, fmt.Errorf("cuetsy parts gen failed: %w", err)
	}

	top, err := cuetsy.GenerateSingleAST(string(makeReplacer(ls.Lineage.Name())), schv, cuetsy.TypeInterface)
	if err != nil {
		return nil, fmt.Errorf("cuetsy top gen failed: %w", err)
	}

	// TODO until cuetsy can toposort its outputs, put the top/parent type at the bottom of the file.
	parts.Nodes = append(parts.Nodes, top.T)
	if top.D != nil {
		parts.Nodes = append(parts.Nodes, top.D)
	}

	var strb strings.Builder
	var str string
	fpath := ls.Lineage.Name() + ".gen.ts"
	strb.WriteString(fmt.Sprintf(genHeader, ls.RelativePath))

	if !ls.IsCanonical {
		fpath = fmt.Sprintf("%s_experimental.gen.ts", ls.Lineage.Name())
		strb.WriteString(`
// This model is a WIP and not yet canonical. Consequently, its members are
// not exported to exclude it from grafana-schema's public API surface.

`)
		strb.WriteString(fmt.Sprint(parts))
		// TODO replace this regexp with cuetsy config for whether members are exported
		re := regexp.MustCompile(`(?m)^export `)
		str = re.ReplaceAllLiteralString(strb.String(), "")
	} else {
		strb.WriteString(fmt.Sprint(parts))
		str = strb.String()
	}

	wd := NewWriteDiffer()
	wd[filepath.Join(path, fpath)] = []byte(str)
	return wd, nil
}

type modelReplacer string

func makeReplacer(name string) modelReplacer {
	return modelReplacer(fmt.Sprintf("%s%s", string(strings.ToUpper(name)[0]), name[1:]))
}

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

// GenerateCoremodelRegistry produces Go files that define a registry with
// references to all the Go code that is expected to be generated from the
// provided lineages.
func GenerateCoremodelRegistry(path string, ecl []*ExtractedLineage) (WriteDiffer, error) {
	var cml []tplVars
	for _, ec := range ecl {
		cml = append(cml, ec.toTemplateObj())
	}

	var buf bytes.Buffer
	err := tmplRegistry.Execute(&buf, struct {
		Coremodels []tplVars
	}{
		Coremodels: cml,
	})
	if err != nil {
		return nil, fmt.Errorf("failed generating template: %w", err)
	}

	byt, err := imports.Process(path, buf.Bytes(), nil)
	if err != nil {
		return nil, fmt.Errorf("goimports processing failed: %w", err)
	}

	wd := NewWriteDiffer()
	wd[path] = byt
	return wd, nil
}

var genHeader = `// This file is autogenerated. DO NOT EDIT.
//
// Run "make gen-cue" from repository root to regenerate.
//
// Derived from the Thema lineage at %s

`

var tmplImports = genHeader + `package {{ .PackageName }}

import (
	"embed"
	"path/filepath"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/thema"
)
`

var tmplAddenda = template.Must(template.New("addenda").Parse(`
//go:embed coremodel.cue
var cueFS embed.FS

// codegen ensures that this is always the latest Thema schema version
var currentVersion = thema.SV({{ .LatestSeqv }}, {{ .LatestSchv }})

// Lineage returns the Thema lineage representing a Grafana {{ .Name }}.
//
// The lineage is the canonical specification of the current {{ .Name }} schema,
// all prior schema versions, and the mappings that allow migration between
// schema versions.
{{- if .IsComposed }}//
// This is the base variant of the schema. It does not include any composed
// plugin schemas.{{ end }}
func Lineage(lib thema.Library, opts ...thema.BindOption) (thema.Lineage, error) {
	return cuectx.LoadGrafanaInstancesWithThema(filepath.Join("pkg", "coremodel", "{{ .Name }}"), cueFS, lib, opts...)
}

var _ thema.LineageFactory = Lineage
var _ coremodel.Interface = &Coremodel{}

// Coremodel contains the foundational schema declaration for {{ .Name }}s.
// It implements coremodel.Interface.
type Coremodel struct {
	lin thema.Lineage
}

// Lineage returns the canonical {{ .Name }} Lineage.
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

// New returns a new instance of the {{ .Name }} coremodel.
//
// Note that this function does not cache, and initially loading a Thema lineage
// can be expensive. As such, the Grafana backend should prefer to access this
// coremodel through a registry (pkg/framework/coremodel/registry), which does cache.
func New(lib thema.Library) (*Coremodel, error) {
	lin, err := Lineage(lib)
	if err != nil {
		return nil, err
	}

	return &Coremodel{
		lin: lin,
	}, nil
}
`))

var tmplTypedef = `{{range .Types}}
{{ with .Schema.Description }}{{ . }}{{ else }}// {{.TypeName}} defines model for {{.JsonName}}.{{ end }}
//
// THIS TYPE IS INTENDED FOR INTERNAL USE BY THE GRAFANA BACKEND, AND IS SUBJECT TO BREAKING CHANGES.
// Equivalent Go types at stable import paths are provided in https://github.com/grafana/grok.
type {{.TypeName}} {{if and (opts.AliasTypes) (.CanAlias)}}={{end}} {{.Schema.TypeDecl}}
{{end}}
`

var tmplRegistry = template.Must(template.New("registry").Parse(`
// This file is autogenerated. DO NOT EDIT.
//
// Generated by pkg/framework/coremodel/gen.go
// Run "make gen-cue" from repository root to regenerate.

package registry

import (
	"fmt"
	"sync"

	"github.com/google/wire"
	{{range .Coremodels }}
	"{{ .PkgPath }}"{{end}}
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/thema"
)

// Base is a registry of coremodel.Interface. It provides two modes for accessing
// coremodels: individually via literal named methods, or as a slice returned from All().
//
// Prefer the individual named methods for use cases where the particular coremodel(s) that
// are needed are known to the caller. For example, a dashboard linter can know that it
// specifically wants the dashboard coremodel.
//
// Prefer All() when performing operations generically across all coremodels. For example,
// a validation HTTP middleware for any coremodel-schematized object type.
type Base struct {
	all []coremodel.Interface
	{{- range .Coremodels }}
	{{ .Name }} *{{ .Name }}.Coremodel{{end}}
}

// type guards
var (
{{- range .Coremodels }}
	_ coremodel.Interface = &{{ .Name }}.Coremodel{}{{end}}
)

{{range .Coremodels }}
// {{ .TitleName }} returns the {{ .Name }} coremodel. The return value is guaranteed to
// implement coremodel.Interface.
func (s *Base) {{ .TitleName }}() *{{ .Name }}.Coremodel {
	return s.{{ .Name }}
}
{{end}}

func doProvideBase(lib thema.Library) *Base {
	var err error
	reg := &Base{}

{{range .Coremodels }}
	reg.{{ .Name }}, err = {{ .Name }}.New(lib)
	if err != nil {
		panic(fmt.Sprintf("error while initializing {{ .Name }} coremodel: %s", err))
	}
    reg.all = append(reg.all, reg.{{ .Name }})
{{end}}

	return reg
}
`))
