//go:build ignore
// +build ignore

package main

import (
	"context"
	"fmt"
	"go/ast"
	"os"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/codegen"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
	"github.com/grafana/thema/encoding/gocode"
	"golang.org/x/tools/go/ast/astutil"
)

// main generator for plugindef. plugindef isn't a kind, so it has its own
// one-off main generator.
func main() {
	v := elsedie(cuectx.BuildGrafanaInstance(nil, "pkg/plugins/plugindef", "", nil))("could not load plugindef cue package")

	lin := elsedie(thema.BindLineage(v, cuectx.GrafanaThemaRuntime()))("plugindef lineage is invalid")

	jl := &codejen.JennyList[thema.Lineage]{}
	jl.AppendOneToOne(&jennytypego{}, &jennybindgo{})
	jl.AddPostprocessors(codegen.SlashHeaderMapper("pkg/plugins/plugindef/gen.go"))

	jfs := elsedie(jl.GenerateFS([]thema.Lineage{lin}))("plugindef jenny pipeline failed")
	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		if err := jfs.Verify(context.Background(), ""); err != nil {
			die(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate", err))
		}
	} else if err := jfs.Write(context.Background(), ""); err != nil {
		die(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}
}

// one-off jenny for plugindef go types
type jennytypego struct{}

func (j *jennytypego) JennyName() string {
	return "PluginGoTypes"
}

func (j *jennytypego) Generate(lin thema.Lineage) (*codejen.File, error) {
	b, err := gocode.GenerateTypesOpenAPI(lin.Latest(), &gocode.TypeConfigOpenAPI{
		ApplyFuncs: []astutil.ApplyFunc{
			codegen.PrefixReplacer("Plugindef", "PluginDef"),
		},
	})
	if err != nil {
		return nil, err
	}
	return codejen.NewFile("plugindef_types_gen.go", b, j), nil
}

// one-off jenny for plugindef go bindings
type jennybindgo struct{}

func (j *jennybindgo) JennyName() string {
	return "PluginGoBindings"
}

func (j *jennybindgo) Generate(lin thema.Lineage) (*codejen.File, error) {
	b, err := gocode.GenerateLineageBinding(lin, &gocode.BindingConfig{
		Assignee: ast.NewIdent("*PluginDef"),
	})
	if err != nil {
		return nil, err
	}
	return codejen.NewFile("plugindef_bindings_gen.go", b, j), nil
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
