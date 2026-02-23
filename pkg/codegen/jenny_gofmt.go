package codegen

import (
	"go/format"
	"path/filepath"

	"golang.org/x/tools/imports"

	"github.com/grafana/codejen"
)

// GoFormat applies go format to each go file
func GoFormat() codejen.FileMapper {
	return func(f codejen.File) (codejen.File, error) {
		if filepath.Ext(f.RelativePath) != ".go" {
			return f, nil
		}

		formatted, err := format.Source(f.Data)
		if err != nil {
			return f, err
		}

		f.Data, err = imports.Process("", formatted, &imports.Options{
			Comments: true,
		})
		return f, err
	}
}
