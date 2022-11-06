package codegen

import (
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/thema"
	"github.com/sdboyer/jennywrites"
)

type OneToOne jennywrites.OneToOne[*DeclForGen]
type OneToMany jennywrites.OneToMany[*DeclForGen]
type ManyToOne jennywrites.ManyToOne[*DeclForGen]
type ManyToMany jennywrites.ManyToMany[*DeclForGen]

// ForGen is a jennywrites input transformer that converts a pure kindsys.SomeDecl into
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

// DeclForGen wraps [kindsys.SomeDecl] to provide trivial caching of
// the lineage declared by the kind (nil for raw kinds).
type DeclForGen struct {
	*kindsys.SomeDecl
	lin thema.Lineage
}

func (decl *DeclForGen) Lineage() thema.Lineage {
	return decl.lin
}

// genGoServiceRefs generates a file within the service directory for a
// structured kind with predictably-named type aliases to the kind's generated
// Go types.
type genGoServiceRefs struct{}

// var _ OneToOne = &genGoServiceRefs{}
