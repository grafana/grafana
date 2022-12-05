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
	"sort"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/grafana/pkg/registry/corekind"
)

func main() {
	kinds := loadKinds()

	sort.Slice(kinds, func(i, j int) bool {
		return kinds[i].Name < kinds[j].Name
	})

	out := elsedie(json.MarshalIndent(kinds, "", "    "))("error generating json output")

	path := filepath.Join(kindsys.DeclParentPath, "report.json")
	file := codejen.NewFile(path, out, reportJenny{})
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

type kind struct {
	Name     string `json:"name"`
	Maturity string `json:"maturity"`
	Type     string `json:"type"`
	Latest   string `json:"latest,omitempty"`
}

func loadKinds() []kind {
	return append(loadStructuredKinds(), loadRawKinds()...)
}

func loadStructuredKinds() []kind {
	b := corekind.NewBase(nil)
	allStructured := b.AllStructured()
	kinds := make([]kind, 0, len(allStructured))

	for _, k := range allStructured {
		kinds = append(kinds, kind{
			Name:     k.MachineName(),
			Maturity: k.Maturity().String(),
			Type:     "structured",
			Latest:   k.Lineage().Latest().Version().String(),
		})
	}

	return kinds
}

func loadRawKinds() []kind {
	b := corekind.NewBase(nil)
	allRaw := b.AllRaw()
	kinds := make([]kind, 0, len(allRaw))

	for _, k := range allRaw {
		kinds = append(kinds, kind{
			Name:     k.MachineName(),
			Maturity: k.Maturity().String(),
			Type:     "raw",
		})
	}

	return kinds
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
