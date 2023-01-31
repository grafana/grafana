package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/thema"
)

type OneToOne codejen.OneToOne[*DefForGen]
type OneToMany codejen.OneToMany[*DefForGen]
type ManyToOne codejen.ManyToOne[*DefForGen]
type ManyToMany codejen.ManyToMany[*DefForGen]

// ForGen is a codejen input transformer that converts a pure kindsys.SomeDef into
// a DefForGen by binding its contained lineage.
func ForGen(rt *thema.Runtime, def kindsys.SomeDef) (*DefForGen, error) {
	lin, err := def.BindKindLineage(rt)
	if err != nil {
		return nil, err
	}

	return &DefForGen{
		SomeDef: def,
		lin:     lin,
	}, nil
}

// DefForGen wraps [kindsys.SomeDef] to provide trivial caching of
// the lineage declared by the kind (nil for raw kinds).
// TODO this type is unneeded - kindsys.Kind is sufficient.
type DefForGen struct {
	kindsys.SomeDef
	lin thema.Lineage
}

// Lineage returns the [thema.Lineage] for the underlying [kindsys.SomeDef].
func (def *DefForGen) Lineage() thema.Lineage {
	return def.lin
}

// ForLatestSchema returns a [SchemaForGen] for the latest schema in this
// DefForGen's lineage.
func (def *DefForGen) ForLatestSchema() SchemaForGen {
	comm := def.Properties.Common()
	return SchemaForGen{
		Name:    comm.Name,
		Schema:  def.Lineage().Latest(),
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
			MainGenerator: maingen,
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
type SchemaForGen struct {
	// The PascalCase name of the schematized type.
	Name string
	// The schema to be rendered for the type itself.
	Schema thema.Schema
	// Whether the schema is grouped. See https://github.com/grafana/thema/issues/62
	IsGroup bool
}
