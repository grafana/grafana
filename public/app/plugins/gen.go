//go:build ignore
// +build ignore

//go:generate go run gen.go

package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/grafana/codejen"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/codegen"
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
		log.Fatal(fmt.Errorf("plugin thema code generator does not currently accept any arguments\n, got %q", os.Args))
	}

	cwd, err := os.Getwd()
	if err != nil {
		log.Fatal(fmt.Errorf("could not get working directory: %s", err))
	}
	grootp := strings.Split(cwd, sep)
	groot := filepath.Join(sep, filepath.Join(grootp[:len(grootp)-3]...))
	lib := cuectx.GrafanaThemaRuntime()

	pluginKindGen := codejen.JennyListWithNamer(func(decl *codegen.PluginTreeDeclForGen) string {
		return decl.Tree.RootPlugin().Meta().Id
	})

	outputFile := filepath.Join("pkg", "plugins", "pfs", "corelist", "corelist_load_gen.go")
	pluginKindGen.Append(codegen.PluginTreeListJenny(outputFile),
		codejen.AdaptOneToMany(codegen.FlattenJenny(corecodegen.GoTypesJenny("pkg/tsdb", nil)), mapToDecls))

	// composableKindsGen := codejen.JennyListWithNamer(func(decl *corecodegen.DeclForGen) string {
	// 	return decl.Meta.Common().MachineName
	// })

	// All the jennies that comprise the composable kinds generator pipeline
	// composableKindsGen.Append(
	// 	corecodegen.GoTypesJenny("pkg/tsdb", nil),
	// 	corecodegen.TSTypesJenny("public/app/plugins", &corecodegen.TSTypesGeneratorConfig{
	// 		GenDirName: func(decl *corecodegen.DeclForGen) string {
	// 			// FIXME this hardcodes always generating to experimental dir. OK for now, but need generator fanout
	// 			return filepath.Join(decl.Meta.Common().MachineName, "x")
	// 		},
	// 	}),
	// )

	// composableKindsAdapter := AdaptTest[*corecodegen.DeclForGen](composableKindsGen, func(ptDecl *codegen.PluginTreeDeclForGen) []*corecodegen.DeclForGen {
	// 	log.Printf("adapting plugin: %s", ptDecl.Tree.RootPlugin().Meta().Id)
	// 	slots := ptDecl.Tree.RootPlugin().SlotImplementations()
	// 	decls := []*corecodegen.DeclForGen{}

	// 	for k, slot := range slots {
	// 		log.Printf("  slot: %s, path: %s", slot.Name(), slot.Underlying().Path().String())
	// 		someDecl := &kindsys.SomeDecl{
	// 			V: slot.Underlying(),
	// 			Meta: kindsys.ComposableMeta{
	// 				CommonMeta: kindsys.CommonMeta{
	// 					Name:              k,
	// 					MachineName:       k,
	// 					PluralName:        k + "s",
	// 					PluralMachineName: k + "s",
	// 				},
	// 				CurrentVersion: slot.Latest().Version(),
	// 			},
	// 		}

	// 		decl := corecodegen.DeclForGenFromLineage(someDecl, slot)
	// 		decls = append(decls, decl)
	// 	}

	// 	return decls
	// })

	// pluginKindGen.AppendManyToMany(composableKindsAdapter)

	var decls []*codegen.PluginTreeDeclForGen
	for _, typ := range []string{"datasource", "panel"} {
		dir := filepath.Join(cwd, typ)
		treeor, err := codegen.ExtractPluginTrees(os.DirFS(dir), lib)
		if err != nil {
			log.Fatalln(fmt.Errorf("extracting plugin trees failed for %s: %s", dir, err))
		}

		for name, option := range treeor {
			if skipPlugins[name] {
				continue
			}

			if option.Tree != nil {
				decls = append(decls, &codegen.PluginTreeDeclForGen{
					Path: filepath.Join(typ, name),
					Tree: (pfs.Tree)(*option.Tree),
				})
			} else if !errors.Is(option.Err, pfs.ErrNoRootFile) {
				log.Fatalln(fmt.Errorf("error parsing plugin directory %s: %s", filepath.Join(dir, name), option.Err))
			}
		}
	}

	// Ensure ptrees are sorted, so that visit order is deterministic. Otherwise
	// having multiple core plugins with errors can cause confusing error
	// flip-flopping
	sort.Slice(decls, func(i, j int) bool {
		return decls[i].Path < decls[j].Path
	})

	jfs, err := pluginKindGen.GenerateFS(decls...)
	if err != nil {
		log.Fatalln(fmt.Errorf("error writing files to disk: %s", err))
	}

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		if err = jfs.Verify(context.Background(), groot); err != nil {
			log.Fatal(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate", err))
		}
	} else if err = jfs.Write(context.Background(), groot); err != nil {
		log.Fatal(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}
}

func main2() {
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

	wd := corecodegen.NewWriteDiffer()
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

	var wdm corecodegen.WriteDiffer
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

	// Converted to use PluginTreeListJenny in main above
	// wdm, err = codegen.GenPluginTreeList(ptrees, "github.com/grafana/grafana/public/app/plugins", filepath.Join(groot, "pkg", "plugins", "pfs", "corelist", "loadlist_gen.go"), false)
	// if err != nil {
	// 	fmt.Fprintf(os.Stderr, "generating plugin loader registry failed: %s\n", err)
	// 	os.Exit(1)
	// }
	// wd.Merge(wdm)

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

type o2oAdapt[InI, OutI codejen.Input] struct {
	fn func(OutI) []InI
	j  codejen.ManyToMany[InI]
}

func (oa *o2oAdapt[InI, OutI]) JennyName() string {
	return oa.j.JennyName()
}

func (oa *o2oAdapt[InI, OutI]) Generate(t ...OutI) (codejen.Files, error) {
	files := codejen.Files{}

	for _, tVal := range t {
		for _, v := range oa.fn(tVal) {
			f, err := oa.j.Generate(v)
			if err != nil {
				return nil, err
			}

			files = append(files, f...)
		}
	}

	return files, nil
}

// AdaptTest takes a [codejen.ManyToMany] jenny that accepts a particular type as input
// (InI), and transforms it into a jenny that accepts a different type
// as input (OutI), given a function that can transform an InI
// to an OutI.
//
// Use this to make jennies reusable in other Input type contexts.
func AdaptTest[InI, OutI codejen.Input](j codejen.ManyToMany[InI], fn func(OutI) []InI) codejen.ManyToMany[OutI] {
	return &o2oAdapt[InI, OutI]{
		fn: fn,
		j:  j,
	}
}

func mapToDecls(pd *codegen.PluginTreeDeclForGen) []*corecodegen.DeclForGen {
	// add logic to map from plugintreedeclforgen to declforgen
	return []*corecodegen.DeclForGen{}
}
