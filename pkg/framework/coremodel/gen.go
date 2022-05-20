// go:build ignore
//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"cuelang.org/go/cue/cuecontext"
	gcgen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/thema"
)

var lib = thema.NewLibrary(cuecontext.New())

const sep = string(filepath.Separator)

var diff bool

// Generate Go and Typescript implementations for all coremodels, and populate the
// coremodel static registry.
func main() {
	if len(os.Args) > 1 {
		fmt.Fprintf(os.Stderr, "coremodel code generator does not currently accept any arguments\n, got %q", os.Args)
		os.Exit(1)
	}

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not get working directory: %s", err)
		os.Exit(1)
	}

	// TODO this binds us to only having coremodels in a single directory. If we need more, compgen is the way
	grootp := strings.Split(cwd, sep)
	groot := filepath.Join(sep, filepath.Join(grootp[:len(grootp)-3]...))

	// For now, call into the grafana-cli code.
	// TODO rip this out of grafana-cli and put it...somewhere
	// if err = commands.DoCuetsify(groot, diff); err != nil {
	// 	fmt.Fprintf(os.Stderr, "failed to generate typescript for plugins: %s", err)
	// 	os.Exit(1)
	// }

	cmroot := filepath.Join(groot, "pkg", "coremodel")
	tsroot := filepath.Join(groot, "packages", "grafana-schema", "src", "schema")

	items, err := ioutil.ReadDir(cmroot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not read coremodels parent dir %s: %s\n", cmroot, err)
		os.Exit(1)
	}

	var lins []*gcgen.ExtractedLineage
	for _, item := range items {
		if item.IsDir() {
			lin, err := gcgen.ExtractLineage(filepath.Join(cmroot, item.Name(), "lineage.cue"), lib)
			if err != nil {
				fmt.Fprintf(os.Stderr, "could not process coremodel dir %s: %s\n", cmroot, err)
				os.Exit(1)
			}

			lins = append(lins, lin)
		}
	}

	for _, ls := range lins {
		err = ls.GenerateGoCoremodel(filepath.Join(cmroot, ls.Lineage.Name()))
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to generate Go code for %s: %s\n", ls.Lineage.Name(), err)
			os.Exit(1)
		}
		err = ls.GenerateTypescriptCoremodel(filepath.Join(tsroot, ls.Lineage.Name()))
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to generate Go code for %s: %s\n", ls.Lineage.Name(), err)
			os.Exit(1)
		}
	}
}
