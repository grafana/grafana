//go:build ignore
// +build ignore

//go:generate go run gen.go

package main

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/load"

	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy"
	"github.com/grafana/grafana/pkg/codegen"
)

// CoreDefParentPath is the path, relative to the repository root, where
// each child directory is expected to contain .cue files defining one
// Core kind.
var CoreDefParentPath = "kinds"

// TSCoreKindParentPath is the path, relative to the repository root, to the directory that
// contains one directory per kind, full of generated TS kind output: types and default consts.
var TSCoreKindParentPath = filepath.Join("packages", "grafana-schema", "src", "raw")

func main() {
	if len(os.Args) > 1 {
		fmt.Fprintf(os.Stderr, "code generator does not currently accept any arguments\n, got %q", os.Args)
		os.Exit(1)
	}

	// Core kinds composite code generator. Produces all generated code in
	// grafana/grafana that derives from core kinds.
	coreKindsGen := codejen.JennyListWithNamer(func(def codegen.SchemaForGen) string {
		return def.Name
	})

	// All the jennies that comprise the core kinds generator pipeline
	coreKindsGen.Append(
		&codegen.GoSpecJenny{},
		&codegen.K8ResourcesJenny{},
		&codegen.CoreRegistryJenny{},
		codegen.LatestMajorsOrXJenny(TSCoreKindParentPath),
		codegen.TSVeneerIndexJenny(filepath.Join("packages", "grafana-schema", "src")),
	)

	header := codegen.SlashHeaderMapper("kinds/gen.go")
	coreKindsGen.AddPostprocessors(header, codegen.GoFormat())

	ctx := cuecontext.New()

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not get working directory: %s", err)
		os.Exit(1)
	}
	groot := filepath.Dir(cwd)

	f := os.DirFS(filepath.Join(groot, CoreDefParentPath))
	kinddirs := elsedie(fs.ReadDir(f, "."))("error reading core kind fs root directory")
	all, err := loadCueFiles(ctx, kinddirs)
	if err != nil {
		die(err)
	}

	sort.Slice(all, func(i, j int) bool {
		return all[i].Name < all[j].Name
	})

	jfs, err := coreKindsGen.GenerateFS(all...)
	if err != nil {
		die(fmt.Errorf("core kinddirs codegen failed: %w", err))
	}

	commfsys := elsedie(genCommon(ctx, groot))("common schemas failed")
	commfsys = elsedie(commfsys.Map(header))("failed gen header on common fsys")
	if err = jfs.Merge(commfsys); err != nil {
		die(err)
	}

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		if err = jfs.Verify(context.Background(), groot); err != nil {
			die(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate", err))
		}
	} else if err = jfs.Write(context.Background(), groot); err != nil {
		die(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}
}

type dummyCommonJenny struct{}

func genCommon(ctx *cue.Context, groot string) (*codejen.FS, error) {
	fsys := codejen.NewFS()
	path := filepath.Join("packages", "grafana-schema", "src", "common")
	fsys = elsedie(fsys.Map(packageMapper))("failed remapping fs")

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
	b := elsedie(cuetsy.Generate(v, cuetsy.Config{
		Export: true,
	}))("failed to generate common schema TS")

	_ = fsys.Add(*codejen.NewFile(filepath.Join(path, "common.gen.ts"), b, dummyCommonJenny{}))
	return fsys, nil
}

func (j dummyCommonJenny) JennyName() string {
	return "CommonSchemaJenny"
}

func (j dummyCommonJenny) Generate(dummy any) ([]codejen.File, error) {
	return nil, nil
}

var pkgReplace = regexp.MustCompile("^package kindsys")

func packageMapper(f codejen.File) (codejen.File, error) {
	f.Data = pkgReplace.ReplaceAllLiteral(f.Data, []byte("package common"))
	return f, nil
}

func elsedie[T any](t T, err error) func(msg string) T {
	if err != nil {
		return func(msg string) T {
			fmt.Fprintf(os.Stderr, "%s: %s\n", msg, err)
			os.Exit(1)
			return t
		}
	}
	return func(msg string) T {
		return t
	}
}

func die(err error) {
	fmt.Fprint(os.Stderr, err, "\n")
	os.Exit(1)
}

func loadCueFiles(ctx *cue.Context, dirs []os.DirEntry) ([]codegen.SchemaForGen, error) {
	values := make([]codegen.SchemaForGen, 0)
	for _, dir := range dirs {
		if !dir.IsDir() {
			continue
		}

		entries, err := os.ReadDir(dir.Name())
		if err != nil {
			fmt.Fprintf(os.Stderr, "error opening %s directory: %s", dir, err)
			os.Exit(1)
		}

		if len(entries) == 0 {
			continue
		}
		// It's assuming that we only have one file in each folder
		entry := filepath.Join(dir.Name(), entries[0].Name())
		cueFile, err := os.ReadFile(entry)
		if err != nil {
			fmt.Fprintf(os.Stderr, "unable to open %s/%s file: %s", dir, entries[0].Name(), err)
			os.Exit(1)
		}

		v := ctx.CompileBytes(cueFile)
		name, err := getSchemaName(v)
		if err != nil {
			return nil, err
		}

		sch := codegen.SchemaForGen{
			Name:       name,
			FilePath:   "./" + filepath.Join(CoreDefParentPath, entry),
			CueFile:    v,
			IsGroup:    false,
			OutputName: strings.ToLower(name),
		}

		values = append(values, sch)
	}

	return values, nil
}

func getSchemaName(v cue.Value) (string, error) {
	namePath := v.LookupPath(cue.ParsePath("name"))
	name, err := namePath.String()
	if err != nil {
		return "", fmt.Errorf("file doesn't have name field set: %s", err)
	}

	name = strings.Replace(name, "-", "_", -1)
	return name, nil
}
