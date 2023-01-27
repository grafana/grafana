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

	"cuelang.org/go/cue/errors"
	"github.com/grafana/codejen"
	"github.com/grafana/cuetsy"
	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/kindsys"
)

func main() {
	if len(os.Args) > 1 {
		fmt.Fprintf(os.Stderr, "plugin thema code generator does not currently accept any arguments\n, got %q", os.Args)
		os.Exit(1)
	}

	// Core kinds composite code generator. Produces all generated code in
	// grafana/grafana that derives from core kinds.
	coreKindsGen := codejen.JennyListWithNamer(func(decl *codegen.DeclForGen) string {
		return decl.Properties.Common().MachineName
	})

	// All the jennies that comprise the core kinds generator pipeline
	coreKindsGen.Append(
		codegen.LatestJenny(kindsys.GoCoreKindParentPath, codegen.GoTypesJenny{}),
		codegen.CoreKindJenny(kindsys.GoCoreKindParentPath, nil),
		codegen.BaseCoreRegistryJenny(filepath.Join("pkg", "registry", "corekind"), kindsys.GoCoreKindParentPath),
		codegen.LatestMajorsOrXJenny(kindsys.TSCoreKindParentPath, codegen.TSTypesJenny{}),
		codegen.TSVeneerIndexJenny(filepath.Join("packages", "grafana-schema", "src")),
		codegen.DocsJenny(filepath.Join("docs", "sources", "developers", "kinds", "core")),
	)

	header := codegen.SlashHeaderMapper("kinds/gen.go")
	coreKindsGen.AddPostprocessors(header)

	cwd, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "could not get working directory: %s", err)
		os.Exit(1)
	}
	groot := filepath.Dir(cwd)

	rt := cuectx.GrafanaThemaRuntime()
	var all []*codegen.DeclForGen

	f := os.DirFS(filepath.Join(groot, kindsys.CoreDeclParentPath))
	kinddirs := elsedie(fs.ReadDir(f, "."))("error reading core kind fs root directory")
	for _, ent := range kinddirs {
		if !ent.IsDir() {
			continue
		}
		rel := filepath.Join(kindsys.CoreDeclParentPath, ent.Name())
		decl, err := kindsys.LoadCoreKind(rel, rt.Context(), nil)
		if err != nil {
			die(fmt.Errorf("%s is not a valid kind: %s", rel, errors.Details(err, nil)))
		}
		if decl.Properties.MachineName != ent.Name() {
			die(fmt.Errorf("%s: kind's machine name (%s) must equal parent dir name (%s)", rel, decl.Properties.Name, ent.Name()))
		}

		all = append(all, elsedie(codegen.ForGen(rt, decl.Some()))(rel))
	}

	sort.Slice(all, func(i, j int) bool {
		return nameFor(all[i].Properties) < nameFor(all[j].Properties)
	})

	jfs, err := coreKindsGen.GenerateFS(all...)
	if err != nil {
		die(fmt.Errorf("core kinddirs codegen failed: %w", err))
	}

	commfsys := elsedie(genCommon(filepath.Join(groot, "pkg", "kindsys")))("common schemas failed")
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

func nameFor(m kindsys.SomeKindProperties) string {
	switch x := m.(type) {
	case kindsys.CoreProperties:
		return x.Name
	case kindsys.CustomProperties:
		return x.Name
	case kindsys.ComposableProperties:
		return x.Name
	default:
		// unreachable so long as all the possibilities in KindProperties have switch branches
		panic("unreachable")
	}
}

type dummyCommonJenny struct{}

func genCommon(kp string) (*codejen.FS, error) {
	fsys := codejen.NewFS()

	// kp := filepath.Join("pkg", "kindsys")
	path := filepath.Join("packages", "grafana-schema", "src", "common")
	// Grab all the common_* files from kindsys and load them in
	dfsys := os.DirFS(kp)
	matches := elsedie(fs.Glob(dfsys, "common_*.cue"))("could not glob kindsys cue files")
	for _, fname := range matches {
		fpath := filepath.Join(path, strings.TrimPrefix(fname, "common_"))
		fpath = fpath[:len(fpath)-4] + "_gen.cue"
		data := elsedie(fs.ReadFile(dfsys, fname))("error reading " + fname)
		_ = fsys.Add(*codejen.NewFile(fpath, data, dummyCommonJenny{}))
	}
	fsys = elsedie(fsys.Map(packageMapper))("failed remapping fs")

	v, err := cuectx.BuildGrafanaInstance(nil, path, "", nil)
	if err != nil {
		return nil, err
	}

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
