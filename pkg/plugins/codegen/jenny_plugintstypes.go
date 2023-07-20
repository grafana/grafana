package codegen

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	tsast "github.com/grafana/cuetsy/ts/ast"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/kindsys"
)

func PluginTSTypesJenny(ctx context.Context, root string, inner codejen.OneToOne[kindsys.Kind], store *store.Service) codejen.OneToMany[kindsys.Provider] {
	return &ptsJenny{
		root:        root,
		inner:       inner,
		ctx:         ctx,
		pluginStore: store,
	}
}

type ptsJenny struct {
	root        string
	inner       codejen.OneToOne[kindsys.Kind]
	pluginStore *store.Service
	ctx         context.Context
}

func (j *ptsJenny) JennyName() string {
	return "PluginTSTypesJenny"
}

func (j *ptsJenny) Generate(provider kindsys.Provider) (codejen.Files, error) {
	all := provider.AllKinds()
	plugin, available := j.pluginStore.Plugin(j.ctx, provider.Name)

	if len(all) == 0 || !available {
		return nil, nil
	}

	files := make(codejen.Files, len(all))
	imports, err := importFromProvider(provider)
	if err != nil {
		return nil, err
	}

	for i, k := range all {
		tsf := &tsast.File{}

		for _, im := range imports {
			if tsim, err := cuectx.ConvertImport(im); err != nil {
				return nil, err
			} else if tsim.From.Value != "" {
				tsf.Imports = append(tsf.Imports, tsim)
			}
		}

		jf, err := j.inner.Generate(k)
		if err != nil {
			return nil, err
		}

		tsf.Nodes = append(tsf.Nodes, tsast.Raw{
			Data: string(jf.Data),
		})

		pluginPath := filepath.Dir(plugin.Module)
		path := filepath.Join(j.root, pluginPath, fmt.Sprintf("%s.gen.ts", k.Lineage().Name()))
		data := []byte(tsf.String())
		data = data[:len(data)-1] // remove the additional line break added by the inner jenny

		files[i] = *codejen.NewFile(path, data, append(jf.From, j)...)
	}

	return files, nil
}
