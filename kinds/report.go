//go:build ignore
// +build ignore

//go:generate go run report.go

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/grafana/pkg/registry/corekind"
)

const reportFileName = "report.json"

func main() {
	report := buildKindStateReport()
	reportJSON := elsedie(json.MarshalIndent(report, "", "  "))("error generating json output")

	path := filepath.Join(kindsys.DeclParentPath, reportFileName)
	file := codejen.NewFile(path, reportJSON, reportJenny{})
	filesystem := elsedie(file.ToFS())("error building in-memory file system")

	cwd := elsedie(os.Getwd())("error getting working directory")
	groot := filepath.Dir(cwd)

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		if err := filesystem.Verify(context.Background(), groot); err != nil {
			die(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate", err))
		}
	} else if err := filesystem.Write(context.Background(), groot); err != nil {
		die(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}
}

type KindStateReport struct {
	Core       []kindsys.CoreStructuredProperties `json:"core"`
	Raw        []kindsys.RawProperties            `json:"raw"`
	Composable []kindsys.ComposableProperties     `json:"composable"`
}

func emptyKindStateReport() KindStateReport {
	return KindStateReport{
		Core:       make([]kindsys.CoreStructuredProperties, 0),
		Raw:        make([]kindsys.RawProperties, 0),
		Composable: make([]kindsys.ComposableProperties, 0),
	}
}

func buildKindStateReport() KindStateReport {
	r := emptyKindStateReport()
	b := corekind.NewBase(nil)

	for _, k := range b.All() {
		switch props := k.Props().(type) {
		case kindsys.CoreStructuredProperties:
			r.Core = append(r.Core, props)
		case kindsys.RawProperties:
			r.Raw = append(r.Raw, props)
		case kindsys.ComposableProperties:
			r.Composable = append(r.Composable, props)
		}
	}

	return r
}

type reportJenny struct{}

func (reportJenny) JennyName() string {
	return "ReportJenny"
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
