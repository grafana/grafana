package datasource

import (
	"github.com/grafana/thema"
)

type Coremodel struct {
	lin thema.Lineage
}

func (c *Coremodel) Lineage() thema.Lineage {
	return c.lin
}

func (c *Coremodel) Schema() thema.Schema {
	sch, err := c.lin.Schema(currentVersion)
	if err != nil {
		// Only reachable if our own schema currentVersion does not exist, which
		// can only happen as a development error
		panic(err)
	}
	return sch
}

func (c *Coremodel) GoType() interface{} {
	return &Model{}
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
