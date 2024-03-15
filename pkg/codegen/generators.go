package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"cuelang.org/go/cue"
	"github.com/grafana/codejen"
)

type OneToOne codejen.OneToOne[SchemaForGen]
type OneToMany codejen.OneToMany[SchemaForGen]
type ManyToOne codejen.ManyToOne[SchemaForGen]
type ManyToMany codejen.ManyToMany[SchemaForGen]

// SlashHeaderMapper produces a FileMapper that injects a comment header onto
// a [codejen.File] indicating the main generator that produced it (via the provided
// maingen, which should be a path) and the jenny or jennies that constructed the
// file.
func SlashHeaderMapper(maingen string) codejen.FileMapper {
	return func(f codejen.File) (codejen.File, error) {
		var leader string
		// Never inject on certain filetypes, it's never valid
		switch filepath.Ext(f.RelativePath) {
		case ".json", ".md":
			return f, nil
		case ".yml", ".yaml":
			leader = "#"
		default:
			leader = "//"
		}

		buf := new(bytes.Buffer)
		if err := tmpls.Lookup("gen_header.tmpl").Execute(buf, tvars_gen_header{
			MainGenerator: filepath.ToSlash(maingen),
			Using:         f.From,
			Leader:        leader,
		}); err != nil {
			return codejen.File{}, fmt.Errorf("failed executing gen header template: %w", err)
		}
		fmt.Fprint(buf, string(f.Data))
		f.Data = buf.Bytes()
		return f, nil
	}
}

type SchemaForGen struct {
	Name       string
	CueFile    cue.Value
	FilePath   string
	IsGroup    bool
	OutputName string // Some TS output files are capitalised and others not.
}
