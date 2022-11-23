//go:build ignore
// +build ignore

package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

var skipPlugins = map[string]bool{
	"canvas":         true,
	"heatmap":        true,
	"heatmap-old":    true,
	"candlestick":    true,
	"state-timeline": true,
	"status-history": true,
	"table":          true,
	"timeseries":     true,
	"influxdb":       true, // plugin.json fails validation (defaultMatchFormat)
	"mixed":          true, // plugin.json fails validation (mixed)
	"opentsdb":       true, // plugin.json fails validation (defaultMatchFormat)
}

const sep = string(filepath.Separator)

func main() {
	if len(os.Args) > 1 {
		fmt.Fprintf(os.Stderr, "plugin thema code generator does not currently accept any arguments\n, got %q", os.Args)
		os.Exit(1)
	}

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not get working directory: %s", err)
		os.Exit(1)
	}
	grootp := strings.Split(cwd, sep)
	groot := filepath.Join(sep, filepath.Join(grootp[:len(grootp)-3]...))

	wd := codegen.NewWriteDiffer()
	lib := cuectx.GrafanaThemaRuntime()

	type ptreepath struct {
		Path string
		Tree *codegen.PluginTree
	}
	var ptrees []codegen.TreeAndPath
	for _, typ := range []string{"datasource", "panel"} {
		dir := filepath.Join(cwd, typ)
		treeor, err := codegen.ExtractPluginTrees(os.DirFS(dir), lib)
		if err != nil {
			fmt.Fprintf(os.Stderr, "extracting plugin trees failed for %s: %s\n", dir, err)
			os.Exit(1)
		}

		for name, option := range treeor {
			if skipPlugins[name] {
				continue
			}

			if option.Tree != nil {
				ptrees = append(ptrees, codegen.TreeAndPath{
					Path: filepath.Join(typ, name),
					Tree: option.Tree,
				})
			} else if !errors.Is(option.Err, pfs.ErrNoRootFile) {
				fmt.Fprintf(os.Stderr, "error parsing plugin directory %s: %s\n", filepath.Join(dir, name), option.Err)
				os.Exit(1)
			}
		}
	}

	// Ensure ptrees are sorted, so that visit order is deterministic. Otherwise
	// having multiple core plugins with errors can cause confusing error
	// flip-flopping
	sort.Slice(ptrees, func(i, j int) bool {
		return ptrees[i].Path < ptrees[j].Path
	})

	var wdm codegen.WriteDiffer
	for _, ptp := range ptrees {
		tfast, err := ptp.Tree.GenerateTypeScriptAST()
		if err != nil {
			fmt.Fprintf(os.Stderr, "generating typescript failed for %s: %s\n", ptp.Path, err)
			os.Exit(1)
		}
		// nil return if there was nothing to generate (no slot implementations)
		if tfast != nil {
			wd[filepath.Join(ptp.Path, "models.gen.ts")] = []byte(tfast.String())
		}

		relp, _ := filepath.Rel(groot, ptp.Path)
		wdm, err = ptp.Tree.GenerateGo(ptp.Path, codegen.GoGenConfig{
			Types: isDatasource(ptp.Tree),
			// TODO false until we decide on a consistent codegen format for core and external plugins
			ThemaBindings: false,
			DocPathPrefix: relp,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "generating Go failed for %s: %s\n", ptp.Path, err)
			os.Exit(1)
		}
		wd.Merge(wdm)
	}

	wdm, err = codegen.GenPluginTreeList(ptrees, "github.com/grafana/grafana/public/app/plugins", filepath.Join(groot, "pkg", "plugins", "pfs", "corelist", "loadlist_gen.go"), false)
	if err != nil {
		fmt.Fprintf(os.Stderr, "generating plugin loader registry failed: %s\n", err)
		os.Exit(1)
	}
	wd.Merge(wdm)

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		err = wd.Verify()
		if err != nil {
			fmt.Fprintf(os.Stderr, "generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate\n\n", err)
			os.Exit(1)
		}
	} else {
		err = wd.Write()
		if err != nil {
			fmt.Fprintf(os.Stderr, "error while writing generated code to disk:\n%s\n", err)
			os.Exit(1)
		}
	}
}

func isDatasource(pt *codegen.PluginTree) bool {
	return string((*pfs.Tree)(pt).RootPlugin().Meta().Type) == "datasource"
}
