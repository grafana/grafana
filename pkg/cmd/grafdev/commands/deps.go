package commands

import (
	"fmt"

	"github.com/grafana/grafana/pkg/cmd/grafdev/base"
	"github.com/urfave/cli/v2"
)

// Deps carries shared resolution for all subcommands.
type Deps struct {
	Resolve func(*cli.Context) (base.RepoPaths, error)
}

func (d Deps) mustResolve(c *cli.Context) (base.RepoPaths, error) {
	p, err := d.Resolve(c)
	if err != nil {
		return base.RepoPaths{}, fmt.Errorf("%w\n(hint: run from the Grafana OSS checkout, pass --oss / --enterprise, or set GRAFANA_DEV_OSS)", err)
	}
	return p, nil
}
