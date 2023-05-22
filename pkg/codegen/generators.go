package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

type OneToOne codejen.OneToOne[kindsys.Kind]
type OneToMany codejen.OneToMany[kindsys.Kind]
type ManyToOne codejen.ManyToOne[kindsys.Kind]
type ManyToMany codejen.ManyToMany[kindsys.Kind]

// ForLatestSchema returns a [SchemaForGen] for the latest schema in the
// provided [kindsys.Kind]'s lineage.
//
// TODO this will be replaced by thema-native constructs
func ForLatestSchema(k kindsys.Kind) SchemaForGen {
	comm := k.Props().Common()
	return SchemaForGen{
		Name:    comm.Name,
		Schema:  k.Lineage().Latest(),
		IsGroup: comm.LineageIsGroup,
	}
}

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

// SchemaForGen is an intermediate values type for jennies that holds both a thema.Schema,
// and values relevant to generating the schema that should properly, eventually, be in
// thema itself.
//
// TODO this will be replaced by thema-native constructs
type SchemaForGen struct {
	// The PascalCase name of the schematized type.
	Name string
	// The schema to be rendered for the type itself.
	Schema thema.Schema
	// Whether the schema is grouped. See https://github.com/grafana/thema/issues/62
	IsGroup bool
}
