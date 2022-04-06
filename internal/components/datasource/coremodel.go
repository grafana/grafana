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

func (c *Coremodel) CurrentVersion() thema.SyntacticVersion {
	return currentVersion
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
