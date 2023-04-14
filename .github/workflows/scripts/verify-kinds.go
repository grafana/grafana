package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing/fstest"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/grafana/pkg/plugins/pfs/corelist"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

func main() {
	jfs := codejen.NewFS()

	var corek []kindsys.Kind
	var compok []kindsys.Composable

	minMaturity := kindsys.MaturityExperimental
	for _, kind := range corekind.NewBase(nil).All() {
		if kind.Maturity().Less(minMaturity) {
			continue
		}
		corek = append(corek, kind)
	}
	for _, pp := range corelist.New(nil) {
		for _, kind := range pp.ComposableKinds {
			if kind.Maturity().Less(minMaturity) {
				continue
			}
			compok = append(compok, kind)
		}
	}

	coreJennies := codejen.JennyList[kindsys.Kind]{}
	coreJennies.Append(
		codegen.SchemaRegistryJenny(filepath.Join("pkg", "schemaregistry")),
	)
	corefs, err := coreJennies.GenerateFS(corek...)
	die(err)
	die(jfs.Merge(corefs))

	composableJennies := codejen.JennyList[kindsys.Composable]{}
	composableJennies.Append(
		ComposableSchemaRegistryJenny(filepath.Join("pkg", "schemaregistry")),
	)
	composablefs, err := composableJennies.GenerateFS(compok...)
	die(err)
	die(jfs.Merge(composablefs))

	if err = jfs.Verify(context.Background(), ""); err != nil {
		die(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate", err))
	}
}

func die(err error) {
	if err != nil {
		fmt.Fprint(os.Stderr, err, "\n")
		os.Exit(1)
	}
}

func ComposableSchemaRegistryJenny(path string) codejen.OneToOne[kindsys.Composable] {
	return &csrJenny{
		path: path,
	}
}

type csrJenny struct {
	path string
}

func (j *csrJenny) JennyName() string {
	return "ComposableSchemaRegistryJenny"
}

func (j *csrJenny) Generate(k kindsys.Composable) (*codejen.File, error) {
	si, err := kindsys.FindSchemaInterface(k.Def().Properties.SchemaInterface)
	if err != nil {
		panic(err)
	}

	name := strings.ToLower(fmt.Sprintf("%s/%s", strings.TrimSuffix(k.Lineage().Name(), si.Name()), si.Name()))

	oldKindString, err := codegen.GetPublishedKind(name, "composable")
	if err != nil {
		return nil, err
	}

	var oldKind kindsys.Kind
	if oldKindString != "" {
		oldKind, err = loadComposableKind(name, oldKindString, "composable")
		if err != nil {
			return nil, err
		}
	}

	// File is new - no need to compare with old lineage
	if oldKind != nil {
		// Check that maturity isn't downgraded
		if k.Maturity().Less(oldKind.Maturity()) {
			return nil, fmt.Errorf("kind maturity can't be downgraded once a kind is published")
		}

		// Check that old schemas do not contain updates if maturity is greater than experimental
		if kindsys.MaturityExperimental.Less(k.Maturity()) && !thema.IsAppendOnly(oldKind.Lineage(), k.Lineage()) {
			return nil, fmt.Errorf("existing schemas in lineage %s cannot be modified", name)
		}
	}

	newKindBytes, err := codegen.KindToBytes(k.Def().V)
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(filepath.Join(j.path, "next", "composable", name+".cue"), newKindBytes, j), nil
}

func loadComposableKind(name string, kind string, category string) (kindsys.Kind, error) {
	parts := strings.Split(name, "/")
	if len(parts) > 1 {
		name = parts[1]
	}

	fs := fstest.MapFS{
		fmt.Sprintf("%s.cue", name): &fstest.MapFile{
			Data: []byte("package grafanaplugin\n" + kind),
		},
	}

	rt := cuectx.GrafanaThemaRuntime()

	def, err := pfs.LoadComposableKindDef(fs, rt, fmt.Sprintf("%s.cue", name))
	if err != nil {
		return nil, fmt.Errorf("%s is not a valid kind: %w", name, err)
	}

	return kindsys.BindComposable(rt, def)
}
