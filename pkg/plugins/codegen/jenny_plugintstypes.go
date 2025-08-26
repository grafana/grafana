package codegen

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	tsast "github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/plugins/codegen/pfs"
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
	genFile := &tsast.File{}
	versionedFile := &tsast.File{}

	for _, im := range decl.Imports {
		if tsim, err := codegen.ConvertImport(im); err != nil {
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
		return codegen.SchemaForGen{
			Name:    derivePascalName(pd.PluginMeta.Id, pd.PluginMeta.Name) + pd.SchemaInterface.Name,
			CueFile: pd.CueFile,
			IsGroup: pd.SchemaInterface.IsGroup,
		}
	})
}

func derivePascalName(id string, name string) string {
	sani := func(s string) string {
		ret := strings.Title(strings.Map(func(r rune) rune {
			switch {
			case r >= 'a' && r <= 'z':
				return r
			case r >= 'A' && r <= 'Z':
				return r
			default:
				return -1
			}
		}, strings.Title(strings.Map(func(r rune) rune {
			switch r {
			case '-', '_':
				return ' '
			default:
				return r
			}
		}, s))))
		if len(ret) > 63 {
			return ret[:63]
		}
		return ret
	}

	fromname := sani(name)
	if len(fromname) != 0 {
		return fromname
	}
	return sani(strings.Split(id, "-")[1])
}

func getGrafanaVersion() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}

	pkg, err := OpenPackageJSON(path.Join(dir, "../../../"))
	if err != nil {
		return ""
	}

	return pkg.Version
}
