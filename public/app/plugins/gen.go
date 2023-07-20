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
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"

	corecodegen "github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/codegen"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/setting"
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

	ctx := context.Background()
	groot := filepath.Clean(filepath.Join(cwd, "../../.."))
	srvs, err := wireServices(groot)
	if err != nil {
		log.Fatal("could not wire services")
		os.Exit(1)
	}

	providers := srvs.kindCatalog.AllProviders(ctx)
	rt := cuectx.GrafanaThemaRuntime()

	pluginKindGen := codejen.JennyListWithNamer(func(p kindsys.Provider) string {
		return p.Name
	})

	pluginKindGen.Append(
		codegen.PluginTreeListJenny(ctx, srvs.pluginStore),
		codegen.PluginGoTypesJenny(ctx, "pkg/tsdb", srvs.pluginStore),
		codegen.PluginTSTypesJenny(ctx, "public/app/plugins", adaptToKind(corecodegen.TSTypesJenny{}), srvs.pluginStore),
		codegen.ProviderToKindsJenny(corecodegen.DocsJenny(
			filepath.Join("docs", "sources", "developers", "kinds", "composable"),
		)),
		codegen.PluginTSEachMajor(ctx, srvs.pluginStore),
	)

	schifs := kindsys.SchemaInterfaces(rt.Context())
	schifnames := make([]string, 0, len(schifs))
	for _, schif := range schifs {
		schifnames = append(schifnames, strings.ToLower(schif.Name()))
	}
	pluginKindGen.AddPostprocessors(corecodegen.SlashHeaderMapper("public/app/plugins/gen.go"), splitSchiffer(schifnames))

	jfs, err := pluginKindGen.GenerateFS(providers...)
	if err != nil {
		log.Fatalln(fmt.Errorf("error writing files to disk: %s", err))
	}

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		if err = jfs.Verify(ctx, groot); err != nil {
			log.Fatal(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate", err))
		}
	} else if err = jfs.Write(ctx, groot); err != nil {
		log.Fatal(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}
}

func adaptToKind(j codejen.OneToOne[corecodegen.SchemaForGen]) codejen.OneToOne[kindsys.Kind] {
	return codejen.AdaptOneToOne(j, func(k kindsys.Kind) corecodegen.SchemaForGen {
		return corecodegen.SchemaForGen{
			Name:    strings.ReplaceAll(k.Name(), " ", ""),
			Schema:  k.Lineage().Latest(),
			IsGroup: k.Props().Common().LineageIsGroup,
		}
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

type wiredServices struct {
	kindCatalog kinds.Catalog
	pluginStore *store.Service
}

func wireServices(groot string) (*wiredServices, error) {
	cfg := &config.Cfg{}
	gCfg := &setting.Cfg{
		StaticRootPath:     fmt.Sprintf("%s/public", groot),
		BundledPluginsPath: fmt.Sprintf("%s/plugins-bundled", groot),
	}

	licence := fakes.NewFakeLicensingService()
	authorizer := signature.NewUnsignedAuthorizer(cfg)
	backendProvider := fakes.NewFakeBackendProcessProvider()
	processManager := fakes.NewFakeProcessManager()
	roleRegistry := fakes.NewFakeRoleRegistry()
	angularInspector, err := angularinspector.NewStaticInspector()
	ap := assetpath.ProvideService(pluginscdn.ProvideService(cfg))
	finder := finder.NewLocalFinder(cfg, newGenFS)
	sig := signature.ProvideService(cfg, statickey.New())

	if err != nil {
		return nil, err
	}

	pluginRegistry := registry.NewInMemory()
	catalog := kinds.NewCatalog()
	loader := loader.New(cfg, licence, authorizer, pluginRegistry, backendProvider,
		processManager, roleRegistry, ap, finder, sig, angularInspector,
		&fakes.FakeOauthService{}, catalog,
	)

	sources := sources.ProvideService(gCfg, cfg)
	store, err := store.ProvideService(pluginRegistry, sources, loader)

	if err != nil {
		return nil, err
	}

	return &wiredServices{
		kindCatalog: catalog,
		pluginStore: store,
	}, nil
}

func newGenFS(dir string) (plugins.FS, error) {
	return &genFS{
		fs:   os.DirFS(dir),
		base: dir,
	}, nil
}

type genFS struct {
	fs   fs.FS
	base string
}

func (dir *genFS) Open(name string) (fs.File, error) {
	return dir.fs.Open(name)
}

func (dir *genFS) Stat(name string) (fs.FileInfo, error) {
	return fs.Stat(dir.fs, name)
}

func (dir *genFS) Base() string {
	return dir.base
}

func (dir *genFS) Files() ([]string, error) {
	return fs.Glob(dir, "*")
}
