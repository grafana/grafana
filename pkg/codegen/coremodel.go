package codegen

import (
	"bytes"
	"errors"
	"fmt"
	"go/ast"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing/fstest"

	cerrors "cuelang.org/go/cue/errors"
	"cuelang.org/go/pkg/encoding/yaml"
	"github.com/deepmap/oapi-codegen/pkg/codegen"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/grafana/cuetsy"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/openapi"
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

	// Indicates whether the coremodel represents an API type, and should therefore
	// be included in API client code generation.
	IsAPIType bool
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

	byt, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	fs := fstest.MapFS{
		"coremodel.cue": &fstest.MapFile{
			Data: byt,
		},
	}

	// ec.RelativePath, err = filepath.Rel(groot, filepath.Dir(path))
	ec.RelativePath, err = filepath.Rel(groot, path)
	if err != nil {
		// should be unreachable, since we rootclimbed to find groot above
		panic(err)
	}
	ec.RelativePath = filepath.ToSlash(ec.RelativePath)
	ec.Lineage, err = cuectx.LoadGrafanaInstancesWithThema(filepath.Dir(ec.RelativePath), fs, lib)
	if err != nil {
		return ec, err
	}
	ec.IsCanonical = isCanonical(ec.Lineage.Name())
	ec.IsAPIType = isAPIType(ec.Lineage.Name())
	return ec, nil
}

// toTemplateObj extracts creates a struct with all the useful strings for template generation.
func (ls *ExtractedLineage) toTemplateObj() tplVars {
	lin := ls.Lineage
	sch := thema.SchemaP(lin, thema.LatestVersion(lin))

	return tplVars{
		Name:        lin.Name(),
		LineagePath: ls.RelativePath,
		PkgPath:     filepath.ToSlash(filepath.Join("github.com/grafana/grafana", filepath.Dir(ls.RelativePath))),
		TitleName:   strings.Title(lin.Name()), // nolint
		LatestSeqv:  sch.Version()[0],
		LatestSchv:  sch.Version()[1],
	}
}

func isCanonical(name string) bool {
	return canonicalCoremodels[name]
}

func isAPIType(name string) bool {
	return !nonAPITypes[name]
}

// FIXME specifying coremodel canonicality DOES NOT belong here - it should be part of the coremodel declaration.
var canonicalCoremodels = map[string]bool{
	"dashboard": false,
}

// FIXME this also needs to be moved into coremodel metadata
var nonAPITypes = map[string]bool{
	"pluginmeta": true,
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

	var importbuf bytes.Buffer
	if err = tmpls.Lookup("coremodel_imports.tmpl").Execute(&importbuf, tvars_coremodel_imports{
		PackageName: lin.Name(),
	}); err != nil {
		return nil, fmt.Errorf("error executing imports template: %w", err)
	}

	gostr, err := codegen.Generate(oT, lin.Name(), codegen.Options{
		GenerateTypes: true,
		SkipPrune:     true,
		SkipFmt:       true,
		UserTemplates: map[string]string{
			"imports.tmpl": importbuf.String(),
			"typedef.tmpl": tmplTypedef,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("openapi generation failed: %w", err)
	}

	buf := new(bytes.Buffer)
	if err = tmpls.Lookup("autogen_header.tmpl").Execute(buf, tvars_autogen_header{
		LineagePath:   ls.RelativePath,
		GeneratorPath: "pkg/framework/coremodel/gen.go", // FIXME hardcoding is not OK
	}); err != nil {
		return nil, fmt.Errorf("error executing header template: %w", err)
	}

	fmt.Fprint(buf, "\n", gostr)

	vars := ls.toTemplateObj()
	err = tmpls.Lookup("addenda.tmpl").Execute(buf, vars)
	if err != nil {
		panic(err)
	}

	fullp := filepath.Join(path, fmt.Sprintf("%s_gen.go", lin.Name()))
	byt, err := postprocessGoFile(genGoFile{
		path:   fullp,
		walker: makePrefixDropper(strings.Title(lin.Name()), "Model"),
		in:     buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	wd := NewWriteDiffer()
	wd[fullp] = byt

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

	top, err := cuetsy.GenerateSingleAST(strings.Title(ls.Lineage.Name()), schv, cuetsy.TypeInterface)
	if err != nil {
		return nil, fmt.Errorf("cuetsy top gen failed: %s", cerrors.Details(err, nil))
	}

	// TODO until cuetsy can toposort its outputs, put the top/parent type at the bottom of the file.
	parts.Nodes = append(parts.Nodes, top.T)
	if top.D != nil {
		parts.Nodes = append(parts.Nodes, top.D)
	}

	var strb strings.Builder
	var str string
	fpath := ls.Lineage.Name() + ".gen.ts"
	if err := tmpls.Lookup("autogen_header.tmpl").Execute(&strb, tvars_autogen_header{
		LineagePath:   ls.RelativePath,
		GeneratorPath: "pkg/framework/coremodel/gen.go", // FIXME hardcoding is not OK
	}); err != nil {
		return nil, fmt.Errorf("error executing header template: %w", err)
	}

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

type prefixDropper struct {
	str     string
	base    string
	rxp     *regexp.Regexp
	rxpsuff *regexp.Regexp
}

func makePrefixDropper(str, base string) prefixDropper {
	return prefixDropper{
		str:     str,
		base:    base,
		rxpsuff: regexp.MustCompile(fmt.Sprintf(`%s([a-zA-Z_]*)`, str)),
		rxp:     regexp.MustCompile(fmt.Sprintf(`%s([\s.,;-])`, str)),
	}
}

func (d prefixDropper) Visit(n ast.Node) ast.Visitor {
	switch x := n.(type) {
	case *ast.Ident:
		if x.Name != d.str {
			x.Name = strings.TrimPrefix(x.Name, d.str)
		} else {
			x.Name = d.base
		}
	case *ast.CommentGroup:
		for _, c := range x.List {
			c.Text = d.rxp.ReplaceAllString(c.Text, d.base+"$1")
			c.Text = d.rxpsuff.ReplaceAllString(c.Text, "$1")
		}
	}
	return d
}

// GenerateCoremodelRegistry produces Go files that define a registry with
// references to all the Go code that is expected to be generated from the
// provided lineages.
func GenerateCoremodelRegistry(path string, ecl []*ExtractedLineage) (WriteDiffer, error) {
	var cml []tplVars
	for _, ec := range ecl {
		cml = append(cml, ec.toTemplateObj())
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("coremodel_registry.tmpl").Execute(buf, tvars_coremodel_registry{
		Header: tvars_autogen_header{
			GeneratorPath: "pkg/framework/coremodel/gen.go", // FIXME hardcoding is not OK
		},
		Coremodels: cml,
	}); err != nil {
		return nil, fmt.Errorf("failed executing coremodel registry template: %w", err)
	}

	byt, err := postprocessGoFile(genGoFile{
		path: path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}
	wd := NewWriteDiffer()
	wd[path] = byt
	return wd, nil
}

var tmplTypedef = `{{range .Types}}
{{ with .Schema.Description }}{{ . }}{{ else }}// {{.TypeName}} is the Go representation of a {{.JsonName}}.{{ end }}
//
// THIS TYPE IS INTENDED FOR INTERNAL USE BY THE GRAFANA BACKEND, AND IS SUBJECT TO BREAKING CHANGES.
// Equivalent Go types at stable import paths are provided in https://github.com/grafana/grok.
type {{.TypeName}} {{if and (opts.AliasTypes) (.CanAlias)}}={{end}} {{.Schema.TypeDecl}}
{{end}}
`
