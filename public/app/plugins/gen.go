//go:build ignore
// +build ignore

package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

var skipPlugins = map[string]bool{
	"barchart":       true,
	"canvas":         true,
	"histogram":      true,
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

// Generate TypeScript for all plugin models.cue
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

	wd := codegen.NewWriteDiffer()
	lib := cuectx.ProvideThemaLibrary()
	ptrees := make(map[string]*codegen.PluginTree)
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
				ptrees[filepath.Join(typ, name)] = option.Tree
			} else if !errors.Is(option.Err, pfs.ErrNoRootFile) {
				fmt.Fprintf(os.Stderr, "error parsing plugin directory %s: %s\n", filepath.Join(dir, name), option.Err)
				os.Exit(1)
			}
		}
	}

	for fullp, ptree := range ptrees {
		twd, err := ptree.GenerateTS(fullp)
		if err != nil {
			fmt.Fprintf(os.Stderr, "generating typescript failed for %s: %s\n", fullp, err)
			os.Exit(1)
		}
		wd.Merge(twd)
	}

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
