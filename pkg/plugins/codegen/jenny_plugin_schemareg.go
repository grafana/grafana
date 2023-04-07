package codegen

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing/fstest"

	"github.com/grafana/codejen"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

// PluginSchemaRegistryJenny checks if published schemas are not updated and generates
// ready to be published kind files into the "next" folder of the local schema registry.
func PluginSchemaRegistryJenny(path string) codejen.OneToOne[*pfs.PluginDecl] {
	return &psrJenny{
		path: path,
	}
}

type psrJenny struct {
	path string
}

func (j *psrJenny) JennyName() string {
	return "PluginSchemaRegistryJenny"
}

func (j *psrJenny) Generate(decl *pfs.PluginDecl) (*codejen.File, error) {
	if !decl.HasSchema() {
		return nil, nil
	}

	name := strings.ToLower(fmt.Sprintf("%s_%s", decl.PluginPath, decl.SchemaInterface.Name()))
	oldKindString, err := corecodegen.GetPublishedKind(name, "composable")
	if err != nil {
		return nil, err
	}

	oldKind, err := loadComposableKind(name, oldKindString, "composable")
	if err != nil {
		return nil, err
	}

	newKindBytes, err := corecodegen.KindToBytes(decl.KindDecl.V)
	if err != nil {
		return nil, err
	}

	// File is new - no need to compare with old lineage
	if oldKind != nil && !thema.IsAppendOnly(oldKind.Lineage(), decl.Lineage) {
		return nil, fmt.Errorf("existing schemas in lineage %s cannot be modified", name)
	}

	return codejen.NewFile(filepath.Join(j.path, "next", "composable", name+".cue"), newKindBytes, j), nil
}

func loadComposableKind(name string, kind string, category string) (kindsys.Kind, error) {
	// re := regexp.MustCompile(`([a-zA-Z]+/([a-zA-Z])_[a-zA-Z]`)
	parts := strings.Split(name, "/")
	if len(parts) > 1 {
		name = parts[1]
	}

	fs := fstest.MapFS{
		fmt.Sprintf("%s.cue", name): &fstest.MapFile{
			Data: []byte("package grafanaplugin\n"+kind),
		},
	}

	rt := cuectx.GrafanaThemaRuntime()

	def, err := pfs.LoadComposableKindDef(fs, rt, fmt.Sprintf("%s.cue", name))
	if err != nil {
		return nil, fmt.Errorf("%s is not a valid kind: %w", name, err)
	}

	return kindsys.BindComposable(rt, def)
}