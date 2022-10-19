//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/framework/kind"
)

// Core kinds code generator. Produces all generated code in grafana/grafana
// that derives from raw and structured core kinds.

// All the single-kind generators to be run for core kinds.
var singles = []codegen.KindGenerator{}

// All the aggregate generators to be run for core kinds.
var multis = []codegen.AggregateKindGenerator{}

const sep = string(filepath.Separator)

func main() {
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
	groot := filepath.Join(sep, filepath.Join(grootp[:len(grootp)-1]...))

	wd := codegen.NewWriteDiffer()
	rt := cuectx.GrafanaThemaRuntime()
	var all []*kind.SomeDecl

	// structured kinds first
	var skinds []*kind.Decl[kind.CoreStructuredMeta]
	f := os.DirFS(filepath.Join(groot, "kind", "structured"))
	ents := elsedie(fs.ReadDir(f, "."))("error reading structured fs root directory")
	for _, ent := range ents {
		rel := filepath.Join("kind", "structured", ent.Name())
		sub := elsedie(fs.Sub(f, ent.Name()))(fmt.Sprintf("error creating subfs for path %s", rel))
		pk, err := kind.LoadCoreKindFS[kind.CoreStructuredMeta](sub, rel, rt.Context())
		if err != nil {
			die(fmt.Errorf("core structured kind at %s is invalid: %w", rel, err))
		}
		if pk.Meta.Name != ent.Name() {
			die(fmt.Errorf("%s: kind name (%s) must equal parent dir name (%s)", rel, pk.Meta.Name, ent.Name()))
		}
		skinds = append(skinds, pk)
		all = append(all, pk.Some())
	}

	// now raw kinds
	var rkinds []*kind.Decl[kind.RawMeta]
	f = os.DirFS(filepath.Join(groot, "kind", "raw"))
	ents = elsedie(fs.ReadDir(f, "."))("error reading raw fs root directory")
	for _, ent := range ents {
		rel := filepath.Join("kind", "raw", ent.Name())
		sub := elsedie(fs.Sub(f, ent.Name()))(fmt.Sprintf("error creating subfs for path %s", rel))
		pk, err := kind.LoadCoreKindFS[kind.RawMeta](sub, rel, rt.Context())
		if err != nil {
			die(fmt.Errorf("raw kind at %s is invalid: %w", rel, err))
		}
		if pk.Meta.Name != ent.Name() {
			die(fmt.Errorf("%s: kind name (%s) must equal parent dir name (%s)", rel, pk.Meta.Name, ent.Name()))
		}
		rkinds = append(rkinds, pk)
		all = append(all, pk.Some())
	}

	// Run all single generators
	for _, gen := range singles {
		for _, pk := range all {
			gf, err := gen.Generate(pk)
			if err != nil {
				die(fmt.Errorf("%s: %w"), err)
			}
			wd[filepath.Join(groot, gf.RelativePath)] = gf.Data
		}
	}

	// Run all multi generators
	for _, gen := range multi {
		gf, err := gen.Generate(all)
		if err != nil {
			die(fmt.Errorf("%s: %w"), err)
		}
		wd[filepath.Join(groot, gf.RelativePath)] = gf.Data
	}

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		err = wd.Verify()
		if err != nil {
			die(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate\n\n", err))
		}
	} else {
		err = wd.Write()
		if err != nil {
			die(fmt.Errorf("error while writing generated code to disk:\n%s\n", err))
		}
	}
}

func elsedie[T any](t T, err error) func(msg string) T {
	if err != nil {
		return func(msg string) T {
			fmt.Fprintf(os.Stderr, "%s: %s", msg, err)
			os.Exit(1)
			return t
		}
	}
	return func(msg string) T {
		return t
	}
}

func die(err error) {
	fmt.Fprint(os.Stderr, err)
	os.Exit(1)
}
