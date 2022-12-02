//go:build ignore
// +build ignore

//go:generate go run gen.go

package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/registry/corekind"
)

type kind struct {
	Name     string `json:"name"`
	Maturity string `json:"maturity"`
	Type     string `json:"type"`
	Latest   string `json:"latest,omitempty"`
}

func main() {
	b := corekind.NewBase(nil)

	allRaw := b.AllRaw()
	allStructured := b.AllStructured()

	kinds := make([]kind, 0, len(allRaw)+len(allStructured))

	for _, k := range allRaw {
		kinds = append(kinds, kind{
			Name:     k.MachineName(),
			Maturity: string(k.Maturity()),
			Type:     "raw",
		})
	}

	for _, k := range allStructured {
		kinds = append(kinds, kind{
			Name:     k.MachineName(),
			Maturity: string(k.Maturity()),
			Type:     "structured",
			Latest:   k.Lineage().Latest().Version().String(),
		})
	}

	out := elsedie(json.Marshal(kinds))("error generating json output")
	fmt.Println(string(out))
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
