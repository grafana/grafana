//go:build ignore
// +build ignore

//go:generate go run gen.go

package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"

	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/codegen"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

var skipPlugins = map[string]bool{
	"canvas":      true,
	"influxdb":    true, // plugin.json fails validation (defaultMatchFormat)
	"mixed":       true, // plugin.json fails validation (mixed)
	"opentsdb":    true, // plugin.json fails validation (defaultMatchFormat)
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
	groot := filepath.Clean(filepath.Join(cwd, "../../.."))
	rt := cuectx.GrafanaThemaRuntime()

	pluginKindGen := codejen.JennyListWithNamer(func(d *pfs.PluginDecl) string {
		return d.PluginMeta.Id
	})

	pluginKindGen.Append(
		codegen.PluginTreeListJenny(),
		codegen.PluginGoTypesJenny("pkg/tsdb"),
		codegen.PluginTSTypesJenny("public/app/plugins", adaptToPipeline(corecodegen.TSTypesJenny{})),
		kind2pd(corecodegen.DocsJenny(
			filepath.Join("docs", "sources", "developers", "kinds", "composable"),
		)),
	)

	pluginKindGen.AddPostprocessors(corecodegen.SlashHeaderMapper("public/app/plugins/gen.go"))

	declParser := pfs.NewDeclParser(rt, skipPlugins)
	decls, err := declParser.Parse(os.DirFS(cwd))
	if err != nil {
		log.Fatalln(fmt.Errorf("parsing plugins in dir failed %s: %s", cwd, err))
	}

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

func adaptToPipeline(j codejen.OneToOne[corecodegen.SchemaForGen]) codejen.OneToOne[*pfs.PluginDecl] {
	return codejen.AdaptOneToOne(j, func(pd *pfs.PluginDecl) corecodegen.SchemaForGen {
		return corecodegen.SchemaForGen{
			Name:    strings.ReplaceAll(pd.PluginMeta.Name, " ", ""),
			Schema:  pd.Lineage.Latest(),
			IsGroup: pd.SchemaInterface.IsGroup(),
		}
	})
}

func kind2pd(j codejen.OneToOne[kindsys.Kind]) codejen.OneToOne[*pfs.PluginDecl] {
	return codejen.AdaptOneToOne(j, func(pd *pfs.PluginDecl) kindsys.Kind {
		kd, err := kindsys.BindComposable(nil, pd.KindDecl)
		if err != nil {
			return nil
		}
		return kd
	})
}
