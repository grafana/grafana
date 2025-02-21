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
	"sort"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/codegen"
)

// CoreDefParentPath is the path, relative to the repository root, where
// each child directory is expected to contain .cue files defining one
// Core kind.
var CoreDefParentPath = "kinds"

// TSCoreKindParentPath is the path, relative to the repository root, to the directory that
// contains one directory per kind, full of generated TS kind output: types and default consts.
var TSCoreKindParentPath = filepath.Join("packages", "grafana-schema", "src", "raw")
var CommonPath = filepath.Join("packages", "grafana-schema", "src", "common")

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
	coreKindsGen.AddPostprocessors(header)

	ctx := cuecontext.New()

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not get working directory: %s", err)
		os.Exit(1)
	}
	groot := filepath.Dir(cwd)

	f := os.DirFS(filepath.Join(groot, CoreDefParentPath))
	kinddirs, err := fs.ReadDir(f, ".")
	if err != nil {
		die(err)
	}
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

	commonGen := codejen.JennyListWithNamer(func(_ string) string {
		return "CommonTS"
	})

	commonGen.Append(codegen.NewTsCommonJenny(CommonPath))
	commonGen.AddPostprocessors(header)

	commonJfs, err := commonGen.GenerateFS()
	if err != nil {
		die(fmt.Errorf("common codegen failed: %w", err))
	}

	if err = jfs.Merge(commonJfs); err != nil {
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

		version, err := getVersion(v)
		if err != nil {
			return nil, err
		}

		sch := codegen.SchemaForGen{
			Name:       name,
			FilePath:   "./" + filepath.Join(CoreDefParentPath, entry),
			CueFile:    v,
			IsGroup:    false,
			Version:    version,
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

func getVersion(val cue.Value) (string, error) {
	val = val.LookupPath(cue.ParsePath("lineage.schemas[0].version"))
	versionValues, err := val.List()
	if err != nil {
		return "", fmt.Errorf("missing version in schema: %s", err)
	}

	version := make([]int64, 0)
	for versionValues.Next() {
		v, err := versionValues.Value().Int64()
		if err != nil {
			return "", fmt.Errorf("version should be a list of two elements: %s", err)
		}

		version = append(version, v)
	}

	return fmt.Sprintf("%d-%d", version[0], version[1]), nil
}
