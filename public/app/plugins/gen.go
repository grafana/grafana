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
	"github.com/grafana/thema"
)

var skipPlugins = map[string]bool{
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
		kind2pd(rt, corecodegen.DocsJenny(
			filepath.Join("docs", "sources", "developers", "kinds", "composable"),
		)),
		codegen.PluginTSEachMajor(rt),
	)

	schifs := kindsys.SchemaInterfaces(rt.Context())
	schifnames := make([]string, 0, len(schifs))
	for _, schif := range schifs {
		schifnames = append(schifnames, strings.ToLower(schif.Name()))
	}
	pluginKindGen.AddPostprocessors(corecodegen.SlashHeaderMapper("public/app/plugins/gen.go"), splitSchiffer(schifnames))

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

func kind2pd(rt *thema.Runtime, j codejen.OneToOne[kindsys.Kind]) codejen.OneToOne[*pfs.PluginDecl] {
	return codejen.AdaptOneToOne(j, func(pd *pfs.PluginDecl) kindsys.Kind {
		kd, err := kindsys.BindComposable(rt, pd.KindDecl)
		if err != nil {
			return nil
		}
		return kd
	})
}

func splitSchiffer(names []string) codejen.FileMapper {
	for i := range names {
		names[i] = names[i] + "/"
	}
	return func(f codejen.File) (codejen.File, error) {
		// TODO it's terrible that this has to exist, CODEJEN NEEDS TO BE BETTER
		for _, name := range names {
			if idx := strings.Index(f.RelativePath, name); idx != -1 {
				f.RelativePath = fmt.Sprintf("%s/%s", f.RelativePath[:idx], f.RelativePath[idx:])
				break
			}
		}
		return f, nil
	}
}
