package dashboard

import (
	"github.com/grafana/thema"
)

// Coremodel contains the foundational schema declaration for dashboards.
type Coremodel struct {
	lin thema.Lineage
}

// Lineage returns the canonical dashboard Lineage.
func (c *Coremodel) Lineage() thema.Lineage {
	return c.lin
}

func (c *Coremodel) CurrentSchema() thema.Schema {
	sch, err := c.lin.Schema(currentVersion)
	if err != nil {
		// Only reachable if our own schema currentVersion does not exist, which
		// can really only happen transitionally during development
		panic(err)
	}
	return sch
}

func (c *Coremodel) GoType() interface{} {
	return &model{}
}

func ProvideCoremodel(lib thema.Library) (*Coremodel, error) {
	lin, err := Lineage(lib)
	if err != nil {
		return nil, err
	}

	return &Coremodel{
		lin: lin,
	}, nil
}
