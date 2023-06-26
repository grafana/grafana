package codegen

import (
	"fmt"
	"os"
	"path"
	"path/filepath"

	"github.com/grafana/codejen"
	tsast "github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/build"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

func PluginTSEachMajor(rt *thema.Runtime) codejen.OneToMany[*pfs.PluginDecl] {
	latestMajorsOrX := corecodegen.LatestMajorsOrXJenny(filepath.Join("packages", "grafana-schema", "src", "raw", "composable"), false, corecodegen.TSTypesJenny{})
	return &pleJenny{
		inner: kinds2pd(rt, latestMajorsOrX),
	}
}

type pleJenny struct {
	inner codejen.OneToMany[*pfs.PluginDecl]
}

func (*pleJenny) JennyName() string {
	return "PluginEachMajorJenny"
}

func (j *pleJenny) Generate(decl *pfs.PluginDecl) (codejen.Files, error) {
	if !decl.HasSchema() {
		return nil, nil
	}

	jf, err := j.inner.Generate(decl)
	if err != nil {
		return nil, err
	}

	version := "export const pluginVersion = \"%s\";"
	if decl.PluginMeta.Info.Version != nil {
		version = fmt.Sprintf(version, *decl.PluginMeta.Info.Version)
	} else {
		version = fmt.Sprintf(version, getGrafanaVersion())
	}

	files := make(codejen.Files, len(jf))
	for i, file := range jf {
		tsf := &tsast.File{}
		for _, im := range decl.Imports {
			if tsim, err := cuectx.ConvertImport(im); err != nil {
				return nil, err
			} else if tsim.From.Value != "" {
				tsf.Imports = append(tsf.Imports, tsim)
			}
		}

		tsf.Nodes = append(tsf.Nodes, tsast.Raw{
			Data: version,
		})

		tsf.Nodes = append(tsf.Nodes, tsast.Raw{
			Data: string(file.Data),
		})

		data := []byte(tsf.String())
		data = data[:len(data)-1] // remove the additional line break added by the inner jenny

		files[i] = *codejen.NewFile(file.RelativePath, data, append(file.From, j)...)
	}

	return files, nil
}

func kinds2pd(rt *thema.Runtime, j codejen.OneToMany[kindsys.Kind]) codejen.OneToMany[*pfs.PluginDecl] {
	return codejen.AdaptOneToMany(j, func(pd *pfs.PluginDecl) kindsys.Kind {
		kd, err := kindsys.BindComposable(rt, pd.KindDecl)
		if err != nil {
			return nil
		}
		return kd
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
