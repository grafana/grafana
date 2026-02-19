//go:build ignore
// +build ignore

//go:generate go run gen.go

package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/load"
	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy"
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
		codegen.PluginGoTypesJenny("pkg/tsdb"),
		codegen.PluginTSTypesJenny("public/app/plugins"),
	)

	pluginKindGen.AddPostprocessors(
		corecodegen.PluginsSlashHeaderMapper("public/app/plugins/gen.go", filepath.Join("public", "app", "plugins")),
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

	// Generate common schemas
	commfsys, err := genCommon(cuecontext.New(), groot)
	if err != nil {
		log.Fatalln(fmt.Errorf("error generating common schemas: %s", err))
	}
	commfsys, err = commfsys.Map(corecodegen.SlashHeaderMapper("kinds/gen.go"))
	if err != nil {
		log.Fatalln(fmt.Errorf("failed gen header on common fsys: %s", err))
	}

	if err = jfs.Merge(commfsys); err != nil {
		log.Fatalln(fmt.Errorf("error mergin common schemas: %s", err))
	}

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		if err = jfs.Verify(context.Background(), groot); err != nil {
			log.Fatal(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate", err))
		}
	} else if err = jfs.Write(context.Background(), groot); err != nil {
		log.Fatal(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}
}

type dummyCommonJenny struct{}

func genCommon(ctx *cue.Context, groot string) (*codejen.FS, error) {
	fsys := codejen.NewFS()
	path := filepath.Join("packages", "grafana-schema", "src", "common")
	fsys, err := fsys.Map(packageMapper)
	if err != nil {
		return nil, fmt.Errorf("mapping packages failed: %w", err)
	}

	commonFiles := make([]string, 0)
	filepath.WalkDir(filepath.Join(groot, path), func(path string, d fs.DirEntry, err error) error {
		if d.IsDir() || filepath.Ext(d.Name()) != ".cue" {
			return nil
		}
		commonFiles = append(commonFiles, path)
		return nil
	})

	instance := load.Instances(commonFiles, &load.Config{})[0]
	if instance.Err != nil {
		return nil, instance.Err
	}

	v := ctx.BuildInstance(instance)
	b, err := cuetsy.Generate(v, cuetsy.Config{
		Export: true,
	})
	if err != nil {
		return nil, fmt.Errorf("generating common schemas failed: %w", err)
	}

	_ = fsys.Add(*codejen.NewFile(filepath.Join(path, "common.gen.ts"), b, dummyCommonJenny{}))
	return fsys, nil
}

func (j dummyCommonJenny) JennyName() string {
	return "CommonSchemaJenny"
}

func (j dummyCommonJenny) Generate(dummy any) ([]codejen.File, error) {
	return nil, nil
}

func packageMapper(f codejen.File) (codejen.File, error) {
	pkgReplace := regexp.MustCompile("^package kindsys")
	f.Data = pkgReplace.ReplaceAllLiteral(f.Data, []byte("package common"))
	return f, nil
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
