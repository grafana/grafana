package codegen

import (
	"bytes"
	"context"
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/kindsys"
)

const prefix = "github.com/grafana/grafana/public/app/plugins"

// PluginTreeListJenny creates a [codejen.ManyToOne] that produces Go code
// for loading a [pfs.PluginList] given [kindsys.Provider] as inputs.
func PluginTreeListJenny(ctx context.Context, store *store.Service) codejen.ManyToOne[kindsys.Provider] {
	outputFile := filepath.Join("pkg", "plugins", "pfs", "corelist", "corelist_load_gen.go")

	return &ptlJenny{
		outputFile:  outputFile,
		pluginStore: store,
		ctx:         ctx,
	}
}

type ptlJenny struct {
	outputFile  string
	pluginStore *store.Service
	ctx         context.Context
}

func (j *ptlJenny) JennyName() string {
	return "PluginTreeListJenny"
}

func (j *ptlJenny) Generate(providers ...kindsys.Provider) (*codejen.File, error) {
	buf := new(bytes.Buffer)
	vars := templateVars_plugin_registry{
		Plugins: make([]struct {
			PkgName, Path, ImportPath string
			NoAlias                   bool
		}, 0, len(providers)),
	}

	type tpl struct {
		PkgName, Path, ImportPath string
		NoAlias                   bool
	}

	for _, p := range providers {
		plugin, available := j.pluginStore.Plugin(j.ctx, p.Name)

		if !available {
			fmt.Printf("plugin not available for provider: %s\n", p.Name)
			continue
		}

		pluginPath := filepath.Join("public", filepath.Dir(plugin.Module))
		pluginId := j.sanitizePluginId(plugin.ID)

		vars.Plugins = append(vars.Plugins, tpl{
			PkgName:    pluginId,
			NoAlias:    pluginId != filepath.Base(pluginPath),
			ImportPath: filepath.ToSlash(filepath.Join(prefix, pluginPath)),
			Path:       path.Join(append(strings.Split(prefix, "/")[3:], pluginPath)...),
		})

	}

	if err := tmpls.Lookup("plugin_registry.tmpl").Execute(buf, vars); err != nil {
		return nil, fmt.Errorf("failed executing plugin registry template: %w", err)
	}

	byt, err := postprocessGoFile(genGoFile{
		path: j.outputFile,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, fmt.Errorf("error postprocessing plugin registry: %w", err)
	}

	return codejen.NewFile(j.outputFile, byt, j), nil
}

func (j *ptlJenny) sanitizePluginId(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			fallthrough
		case r >= 'A' && r <= 'Z':
			fallthrough
		case r >= '0' && r <= '9':
			fallthrough
		case r == '_':
			return r
		case r == '-':
			return '_'
		default:
			return -1
		}
	}, s)
}
