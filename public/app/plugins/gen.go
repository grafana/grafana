//go:build ignore
// +build ignore

//go:generate go run gen.go

package main

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/load"
	"github.com/grafana/codejen"
	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/codegen"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

var skipPlugins = map[string]bool{
	"influxdb": true, // plugin.json fails validation (defaultMatchFormat)
	"mixed":    true, // plugin.json fails validation (mixed)
	"opentsdb": true, // plugin.json fails validation (defaultMatchFormat)
}

var cueImportsPath = filepath.Join("packages", "grafana-schema", "src", "common")
var importPath = "github.com/grafana/grafana/packages/grafana-schema/src/common"

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
		codegen.PluginGoTypesJenny("pkg/tsdb"),
		codegen.PluginTSTypesJenny("public/app/plugins", adaptToPipeline(corecodegen.TSTypesJenny{})),
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

	rawResources, err := genRawResources()
	if err != nil {
		log.Fatalln(fmt.Errorf("error generating raw plugin resources: %s", err))
	}

	if err := jfs.Merge(rawResources); err != nil {
		log.Fatalln(fmt.Errorf("Unable to merge raw resources: %s", err))
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

func genRawResources() (*codejen.FS, error) {
	jennies := codejen.JennyListWithNamer(func(d []corecodegen.CueSchema) string {
		return "PluginsRawResources"
	})
	jennies.Append(&codegen.PluginRegistryJenny{})

	schemas := make([]corecodegen.CueSchema, 0)
	filepath.WalkDir(".", func(path string, d fs.DirEntry, err error) error {
		if d.IsDir() {
			return nil
		}

		if !strings.HasSuffix(d.Name(), ".cue") {
			return nil
		}

		v, err := cueLoader(path)
		if err != nil {
			return err
		}

		schemas = append(schemas, corecodegen.CueSchema{
			CueFile:  v,
			FilePath: "./" + filepath.Join("public", "plugins", path),
		})

		return nil
	})

	return jennies.GenerateFS(schemas)
}

func cueLoader(entrypoint string) (cue.Value, error) {
	commonFS, err := mockCommonFS()
	if err != nil {
		fmt.Printf("cannot load common cue files: %s\n", err)
		return cue.Value{}, err
	}

	overlay, err := buildOverlay(commonFS)
	if err != nil {
		fmt.Printf("Cannot build overlay: %s\n", err)
		return cue.Value{}, err
	}

	bis := load.Instances([]string{entrypoint}, &load.Config{
		ModuleRoot: "/",
		Overlay:    overlay,
	})

	values, err := cuecontext.New().BuildInstances(bis)
	if err != nil {
		fmt.Printf("Cannot build instance: %s\n", err)
		return cue.Value{}, err
	}

	return values[0], nil
}

func mockCommonFS() (fs.FS, error) {
	path := filepath.Join("../../../", cueImportsPath)
	dir, err := os.ReadDir(path)
	if err != nil {
		return nil, fmt.Errorf("cannot open common cue files directory: %s", err)
	}

	prefix := "cue.mod/pkg/" + importPath

	commonFS := fstest.MapFS{}
	for _, d := range dir {
		if d.IsDir() {
			continue
		}

		b, err := os.ReadFile(filepath.Join(path, d.Name()))
		if err != nil {
			return nil, err
		}

		commonFS[filepath.Join(prefix, d.Name())] = &fstest.MapFile{Data: b}
	}

	return commonFS, nil
}

// It loads common cue files into the schema to be able to make import works
func buildOverlay(commonFS fs.FS) (map[string]load.Source, error) {
	overlay := make(map[string]load.Source)

	err := fs.WalkDir(commonFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		f, err := commonFS.Open(path)
		if err != nil {
			return err
		}
		defer func() { _ = f.Close() }()

		b, err := io.ReadAll(f)
		if err != nil {
			return err
		}

		overlay[filepath.Join("/", path)] = load.FromBytes(b)

		return nil
	})

	return overlay, err
}
