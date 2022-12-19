package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/thema"
)

type OneToOne codejen.OneToOne[*DeclForGen]
type OneToMany codejen.OneToMany[*DeclForGen]
type ManyToOne codejen.ManyToOne[*DeclForGen]
type ManyToMany codejen.ManyToMany[*DeclForGen]

// ForGen is a codejen input transformer that converts a pure kindsys.SomeDecl into
// a DeclForGen by binding its contained lineage.
func ForGen(rt *thema.Runtime, decl *kindsys.SomeDecl) (*DeclForGen, error) {
	lin, err := decl.BindKindLineage(rt)
	if err != nil {
		return nil, err
	}

	return &DeclForGen{
		SomeDecl: decl,
		lin:      lin,
	}, nil
}

// RawForGen produces a [DeclForGen] from a [kindsys.Raw] kind.
//
// Useful for grafana-external code generators, which depend on the Kind
// representation in registries produced by grafana core (such as
// ["github.com/grafana/grafana/pkg/registry/corekind".NewBase]).
func RawForGen(k kindsys.Raw) *DeclForGen {
	return &DeclForGen{
		SomeDecl: k.Decl().Some(),
	}
}

// StructuredForGen produces a [DeclForGen] from a [kindsys.Structured] kind.
//
// Useful for grafana-external code generators, which depend on the Kind
// representation in registries produced by grafana core (such as
// ["github.com/grafana/grafana/pkg/registry/corekind".NewBase]).
func StructuredForGen(k kindsys.Structured) *DeclForGen {
	return &DeclForGen{
		SomeDecl: k.Decl().Some(),
		lin:      k.Lineage(),
	}
}

// DeclForGen wraps [kindsys.SomeDecl] to provide trivial caching of
// the lineage declared by the kind (nil for raw kinds).
type DeclForGen struct {
	*kindsys.SomeDecl
	lin thema.Lineage
}

// Lineage returns the [thema.Lineage] for the underlying [kindsys.SomeDecl].
func (decl *DeclForGen) Lineage() thema.Lineage {
	return decl.lin
}

// ForLatestSchema returns a [SchemaForGen] for the latest schema in this
// DeclForGen's lineage.
func (decl *DeclForGen) ForLatestSchema() SchemaForGen {
	comm := decl.Properties.Common()
	return SchemaForGen{
		Name:    comm.Name,
		Schema:  decl.Lineage().Latest(),
		IsGroup: comm.LineageIsGroup,
	}
}

// SlashHeaderMapper produces a FileMapper that injects a comment header onto
// a [codejen.File] indicating the main generator that produced it (via the provided
// maingen, which should be a path) and the jenny or jennies that constructed the
// file.
func SlashHeaderMapper(maingen string) codejen.FileMapper {
	return func(f codejen.File) (codejen.File, error) {
		// Never inject on certain filetypes, it's never valid
		switch filepath.Ext(f.RelativePath) {
		case ".json", ".yml", ".yaml", ".md":
			return f, nil
		default:
			buf := new(bytes.Buffer)
			if err := tmpls.Lookup("gen_header.tmpl").Execute(buf, tvars_gen_header{
				MainGenerator: maingen,
				Using:         f.From,
			}); err != nil {
				return codejen.File{}, fmt.Errorf("failed executing gen header template: %w", err)
			}
			fmt.Fprint(buf, string(f.Data))
			f.Data = buf.Bytes()
		}
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
