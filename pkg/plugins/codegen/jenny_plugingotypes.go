package codegen

import (
	"context"
	"fmt"
	"path/filepath"

	copenapi "cuelang.org/go/encoding/openapi"
	"github.com/dave/dst/dstutil"
	"github.com/grafana/codejen"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema/encoding/gocode"
	"github.com/grafana/thema/encoding/openapi"
)

// TODO this is duplicative of other Go type jennies. Remove it in favor of a better-abstracted version in thema itself
func PluginGoTypesJenny(ctx context.Context, root string, store *store.Service) codejen.OneToMany[kindsys.Provider] {
	return &pgoJenny{
		root:        root,
		pluginStore: store,
		ctx:         ctx,
	}
}

type pgoJenny struct {
	root        string
	pluginStore *store.Service
	ctx         context.Context
}

func (j *pgoJenny) JennyName() string {
	return "PluginGoTypesJenny"
}

func (j *pgoJenny) Generate(provider kindsys.Provider) (codejen.Files, error) {
	plugin, available := j.pluginStore.Plugin(j.ctx, provider.Name)
	pluginfolder := resolvePluginFolder(plugin)

	if !available {
		return nil, fmt.Errorf("plugin not available for provider: %s", provider.Name)
	}

	all := provider.AllKinds()

	if len(all) == 0 || !plugin.Backend {
		return nil, nil
	}

	files := make(codejen.Files, len(all))

	for i, k := range all {
		lin := k.Lineage()

		byt, err := gocode.GenerateTypesOpenAPI(lin.Latest(), &gocode.TypeConfigOpenAPI{
			Config: &openapi.Config{
				Group: k.Props().Common().LineageIsGroup,
				Config: &copenapi.Config{
					MaxCycleDepth: 10,
				},
				SplitSchema: true,
			},
			PackageName: lin.Name(),
			ApplyFuncs:  []dstutil.ApplyFunc{corecodegen.PrefixDropper(lin.Name())},
		})
		if err != nil {
			return nil, err
		}

		filename := fmt.Sprintf("types_%s_gen.go", lin.Name())
		fp := filepath.Join(j.root, pluginfolder, "kinds", lin.Name(), filename)
		files[i] = *codejen.NewFile(fp, byt, j)
	}

	return files, nil
}

func resolvePluginFolder(p plugins.PluginDTO) string {
	pluginfolder := filepath.Base(filepath.Dir(p.Module))
	// // hardcoded exception for testdata datasource, ONLY because "testdata" is basically a
	// // language-reserved keyword for Go
	if pluginfolder == "testdata" {
		return "testdatasource"
	}
	return pluginfolder
}
