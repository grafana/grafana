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
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/plugins/codegen"
	"github.com/grafana/grafana/pkg/plugins/codegen/pfs"
)

var skipPlugins = map[string]bool{
	"influxdb": true, // plugin.json fails validation (defaultMatchFormat)
	"mixed":    true, // plugin.json fails validation (mixed)
	"opentsdb": true, // plugin.json fails validation (defaultMatchFormat)
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

	pluginKindGen := codejen.JennyListWithNamer(func(d *pfs.PluginDecl) string {
		return d.PluginMeta.Id
	})

	pluginKindGen.Append(
		&codegen.PluginRegistryJenny{},
		codegen.PluginGoTypesJenny("pkg/tsdb"),
		codegen.PluginTSTypesJenny("public/app/plugins"),
	)

	pluginKindGen.AddPostprocessors(
		corecodegen.SlashHeaderMapper("public/app/plugins/gen.go"),
		corecodegen.GoFormat(),
		splitSchiffer(),
	)

	declParser := pfs.NewDeclParser(skipPlugins)
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

func splitSchiffer() codejen.FileMapper {
	names := []string{"panelcfg", "dataquery"}
	return func(f codejen.File) (codejen.File, error) {
		// TODO it's terrible that this has to exist, CODEJEN NEEDS TO BE BETTER
		path := filepath.ToSlash(f.RelativePath)
		for _, name := range names {
			if idx := strings.Index(path, name); idx != -1 {
				f.RelativePath = fmt.Sprintf("%s/%s", path[:idx], path[idx:])
				break
			}
		}
		return f, nil
	}
}
