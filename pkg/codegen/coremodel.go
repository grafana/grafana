package codegen

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing/fstest"

	cerrors "cuelang.org/go/cue/errors"
	"cuelang.org/go/pkg/encoding/yaml"
	"github.com/deepmap/oapi-codegen/pkg/codegen"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/grafana/cuetsy"
	tsast "github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/openapi"
)

// CoremodelDeclaration contains the results of statically analyzing a Grafana
// directory for a Thema lineage.
type CoremodelDeclaration struct {
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
func ExtractLineage(path string, rt *thema.Runtime) (*CoremodelDeclaration, error) {
	if !filepath.IsAbs(path) {
		return nil, fmt.Errorf("must provide an absolute path, got %q", path)
	}

	ec := &CoremodelDeclaration{
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
	ec.Lineage, err = cuectx.LoadGrafanaInstancesWithThema(filepath.Dir(ec.RelativePath), fs, rt)
	if err != nil {
		return ec, err
	}
	ec.IsCanonical = isCanonical(ec.Lineage.Name())
	ec.IsAPIType = isAPIType(ec.Lineage.Name())
	return ec, nil
}

// toTemplateObj extracts creates a struct with all the useful strings for template generation.
func (cd *CoremodelDeclaration) toTemplateObj() tplVars {
	lin := cd.Lineage
	sch := thema.SchemaP(lin, thema.LatestVersion(lin))

	return tplVars{
		Name:        lin.Name(),
		LineagePath: cd.RelativePath,
		PkgPath:     filepath.ToSlash(filepath.Join("github.com/grafana/grafana", filepath.Dir(cd.RelativePath))),
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

// PathVersion returns the string path element to use for the latest schema.
// "x" if not yet canonical, otherwise, "v<major>"
func (cd *CoremodelDeclaration) PathVersion() string {
	if !cd.IsCanonical {
		return "x"
	}
	return fmt.Sprintf("v%v", thema.LatestVersion(cd.Lineage)[0])
}

// GenerateGoCoremodel generates a standard Go model struct and coremodel
// implementation from a coremodel CUE declaration.
//
// The provided path must be a directory. Generated code files will be written
// to that path. The final element of the path must match the Lineage.Name().
func (cd *CoremodelDeclaration) GenerateGoCoremodel(path string) (WriteDiffer, error) {
	lin, rt := cd.Lineage, cd.Lineage.Runtime()
	_, name := filepath.Split(path)
	if name != lin.Name() {
		return nil, fmt.Errorf("lineage name %q must match final element of path, got %q", lin.Name(), path)
	}

	sch := thema.SchemaP(lin, thema.LatestVersion(lin))
	f, err := openapi.GenerateSchema(sch, nil)
	if err != nil {
		return nil, fmt.Errorf("thema openapi generation failed: %w", err)
	}

	str, err := yaml.Marshal(rt.Context().BuildFile(f))
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

	gostr, err := codegen.Generate(oT, codegen.Configuration{
		PackageName: lin.Name(),
		Generate: codegen.GenerateOptions{
			Models: true,
		},
		Compatibility: codegen.CompatibilityOptions{
			AlwaysPrefixEnumValues: true,
		},
		OutputOptions: codegen.OutputOptions{
			SkipFmt:   true,
			SkipPrune: true,
			UserTemplates: map[string]string{
				"imports.tmpl": importbuf.String(),
				"typedef.tmpl": tmplTypedef,
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("openapi generation failed: %w", err)
	}

	buf := new(bytes.Buffer)
	if err = tmpls.Lookup("autogen_header.tmpl").Execute(buf, tvars_autogen_header{
		LineagePath:   cd.RelativePath,
		GeneratorPath: "pkg/framework/coremodel/gen.go", // FIXME hardcoding is not OK
	}); err != nil {
		return nil, fmt.Errorf("error executing header template: %w", err)
	}

	fmt.Fprint(buf, "\n", gostr)

	vars := cd.toTemplateObj()
	err = tmpls.Lookup("addenda.tmpl").Execute(buf, vars)
	if err != nil {
		panic(err)
	}

	fullp := filepath.Join(path, fmt.Sprintf("%s_gen.go", lin.Name()))
	byt, err := postprocessGoFile(genGoFile{
		path:   fullp,
		walker: PrefixDropper(strings.Title(lin.Name())),
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

func (cd *CoremodelDeclaration) GenerateTypescriptCoremodel() (*tsast.File, error) {
	schv := cd.Lineage.Latest().Underlying()

	tf, err := cuetsy.GenerateAST(schv, cuetsy.Config{
		Export: true,
	})
	if err != nil {
		return nil, fmt.Errorf("cuetsy tf gen failed: %w", err)
	}

	top, err := cuetsy.GenerateSingleAST(strings.Title(cd.Lineage.Name()), schv, cuetsy.TypeInterface)
	if err != nil {
		return nil, fmt.Errorf("cuetsy top gen failed: %s", cerrors.Details(err, nil))
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("autogen_header.tmpl").Execute(buf, tvars_autogen_header{
		LineagePath:   cd.RelativePath,
		GeneratorPath: "pkg/framework/coremodel/gen.go", // FIXME hardcoding is not OK
	}); err != nil {
		return nil, fmt.Errorf("error executing header template: %w", err)
	}
	tf.Doc = &tsast.Comment{
		Text: buf.String(),
	}

	// TODO until cuetsy can toposort its outputs, put the top/parent type at the bottom of the file.
	tf.Nodes = append(tf.Nodes, top.T)
	if top.D != nil {
		tf.Nodes = append(tf.Nodes, top.D)
	}
	return tf, nil
}

var tmplTypedef = `{{range .Types}}
{{ with .Schema.Description }}{{ . }}{{ else }}// {{.TypeName}} is the Go representation of a {{.JsonName}}.{{ end }}
//
// THIS TYPE IS INTENDED FOR INTERNAL USE BY THE GRAFANA BACKEND, AND IS SUBJECT TO BREAKING CHANGES.
// Equivalent Go types at stable import paths are provided in https://github.com/grafana/grok.
type {{.TypeName}} {{if and (opts.AliasTypes) (.CanAlias)}}={{end}} {{.Schema.TypeDecl}}
{{end}}
`
