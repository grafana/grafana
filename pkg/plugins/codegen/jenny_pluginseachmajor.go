package codegen

import (
	"context"
	"fmt"
	"os"
	"path"
	"path/filepath"

	"github.com/grafana/codejen"
	tsast "github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/build"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/kindsys"
)

func PluginTSEachMajor(ctx context.Context, store *store.Service) codejen.OneToMany[kindsys.Provider] {
	latestMajorsOrX := corecodegen.LatestMajorsOrXJenny(filepath.Join("packages", "grafana-schema", "src", "raw", "composable"), false, corecodegen.TSTypesJenny{})
	return &pleJenny{
		inner:       latestMajorsOrX,
		ctx:         ctx,
		pluginStore: store,
	}
}

type pleJenny struct {
	inner       codejen.OneToMany[kindsys.Kind]
	pluginStore *store.Service
	ctx         context.Context
}

func (*pleJenny) JennyName() string {
	return "PluginEachMajorJenny"
}

func (j *pleJenny) Generate(provider kindsys.Provider) (codejen.Files, error) {
	all := provider.AllKinds()
	plugin, available := j.pluginStore.Plugin(j.ctx, provider.Name)

	if len(all) == 0 || !available {
		return nil, nil
	}

	version := fmt.Sprintf("export const pluginVersion = \"%s\";", plugin.Info.Version)
	files := make(codejen.Files, 0)
	imports, err := importFromProvider(provider)

	if err != nil {
		return nil, err
	}

	for _, k := range all {
		jf, err := j.inner.Generate(k)
		if err != nil {
			continue
		}

		jfiles := make(codejen.Files, len(jf))
		for i, file := range jf {
			tsf := &tsast.File{}
			for _, im := range imports {
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

			jfiles[i] = *codejen.NewFile(file.RelativePath, data, append(file.From, j)...)
		}

		files = append(files, jfiles...)

	}

	return files, nil
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
