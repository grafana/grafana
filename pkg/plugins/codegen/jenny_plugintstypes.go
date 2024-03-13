package codegen

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	tsast "github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/build"
	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

var versionedPluginPath = filepath.Join("packages", "grafana-schema", "src", "raw", "composable")

func PluginTSTypesJenny(root string) codejen.OneToMany[*pfs.PluginDecl] {
	return &ptsJenny{
		root:  root,
		inner: adaptToPipeline(codegen.TSTypesJenny{}),
	}
}

type ptsJenny struct {
	root  string
	inner codejen.OneToOne[*pfs.PluginDecl]
}

func (j *ptsJenny) JennyName() string {
	return "PluginTsTypesJenny"
}

func (j *ptsJenny) Generate(decl *pfs.PluginDecl) (codejen.Files, error) {
	if !decl.HasSchema() {
		return nil, nil
	}

	genFile := &tsast.File{}
	versionedFile := &tsast.File{}

	for _, im := range decl.Imports {
		if tsim, err := cuectx.ConvertImport(im); err != nil {
			return nil, err
		} else if tsim.From.Value != "" {
			genFile.Imports = append(genFile.Imports, tsim)
			versionedFile.Imports = append(versionedFile.Imports, tsim)
		}
	}

	jf, err := j.inner.Generate(decl)
	if err != nil {
		return nil, err
	}

	rawData := tsast.Raw{Data: string(jf.Data)}
	rawVersion := tsast.Raw{
		Data: getPluginVersion(decl.PluginMeta.Version),
	}

	genFile.Nodes = append(genFile.Nodes, rawData)

	genPath := filepath.Join(j.root, decl.PluginPath, fmt.Sprintf("%s.gen.ts", strings.ToLower(decl.SchemaInterface.Name)))
	data := []byte(genFile.String())
	data = data[:len(data)-1] // remove the additional line break added by the inner jenny

	files := make(codejen.Files, 2)
	files[0] = *codejen.NewFile(genPath, data, append(jf.From, j)...)

	versionedFile.Nodes = append(versionedFile.Nodes, rawVersion, rawData)

	versionedData := []byte(versionedFile.String())
	versionedData = versionedData[:len(versionedData)-1]

	pluginFolder := strings.ReplaceAll(strings.ToLower(decl.PluginMeta.Name), " ", "")
	versionedPath := filepath.Join(versionedPluginPath, pluginFolder, strings.ToLower(decl.SchemaInterface.Name), "x", jf.RelativePath)
	files[1] = *codejen.NewFile(versionedPath, versionedData, append(jf.From, j)...)

	return files, nil
}

func getPluginVersion(pluginVersion *string) string {
	version := "export const pluginVersion = \"%s\";"
	if pluginVersion != nil {
		version = fmt.Sprintf(version, *pluginVersion)
	} else {
		version = fmt.Sprintf(version, getGrafanaVersion())
	}

	return version
}

func adaptToPipeline(j codejen.OneToOne[codegen.SchemaForGen]) codejen.OneToOne[*pfs.PluginDecl] {
	return codejen.AdaptOneToOne(j, func(pd *pfs.PluginDecl) codegen.SchemaForGen {
		name := strings.ReplaceAll(pd.PluginMeta.Name, " ", "")
		if pd.SchemaInterface.Name == "DataQuery" {
			name = name + "DataQuery"
		}
		return codegen.SchemaForGen{
			Name:    name,
			Schema:  pd.Lineage.Latest(),
			IsGroup: pd.SchemaInterface.IsGroup,
		}
	})
}

func getGrafanaVersion() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}

	pkg, err := build.OpenPackageJSON(path.Join(dir, "../../../"))
	if err != nil {
		return ""
	}

	return pkg.Version
}
