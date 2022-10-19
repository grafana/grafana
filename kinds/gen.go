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

	// structured kinds first
	var skinds []*codegen.ParsedCoreStructuredKind
	f := os.DirFS(filepath.Join(groot, "kind", "structured"))
	ents := elsedie(fs.ReadDir(f, "."))("error reading structured fs root directory")
	for _, ent := range ents {
		rel := filepath.Join("kind", "structured", ent.Name())
		sub := elsedie(fs.Sub(f, ent.Name()))(fmt.Sprintf("error creating subfs for path %s", rel))
		pk, err := kind.ParseCoreKindFS[kind.CoreStructuredMeta](sub, rel, rt.Context())
		if err != nil {
			die(fmt.Errorf("core structured kind at %s is invalid: %w", rel, err))
		}
		if pk.Meta.Name != ent.Name() {
			die(fmt.Errorf("%s: kind name (%s) must equal parent dir name (%s)", rel, pk.Meta.Name, ent.Name()))
		}
		skinds = append(skinds, (*codegen.ParsedCoreStructuredKind)(pk))
	}

	// now raw kinds
	var rkinds []*codegen.ParsedRawKind
	f = os.DirFS(filepath.Join(groot, "kind", "raw"))
	ents = elsedie(fs.ReadDir(f, "."))("error reading raw fs root directory")
	for _, ent := range ents {
		rel := filepath.Join("kind", "raw", ent.Name())
		sub := elsedie(fs.Sub(f, ent.Name()))(fmt.Sprintf("error creating subfs for path %s", rel))
		pk, err := kind.ParseCoreKindFS[kind.RawMeta](sub, rel, rt.Context())
		if err != nil {
			die(fmt.Errorf("raw kind at %s is invalid: %w", rel, err))
		}
		if pk.Meta.Name != ent.Name() {
			die(fmt.Errorf("%s: kind name (%s) must equal parent dir name (%s)", rel, pk.Meta.Name, ent.Name()))
		}
		rkinds = append(rkinds, (*codegen.ParsedRawKind)(pk))
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
