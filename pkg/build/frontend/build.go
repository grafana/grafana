package frontend

import (
	"fmt"
	"log"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/errutil"
	"github.com/grafana/grafana/pkg/build/lerna"
	"github.com/grafana/grafana/pkg/build/syncutil"
)

func BuildFrontendPackages(version string, edition config.Edition, grafanaDir string, p syncutil.WorkerPool, g *errutil.Group) error {
	p.Schedule(g.Wrap(func() error {
		if err := lerna.BuildFrontendPackages(version, edition, grafanaDir); err != nil {
			return fmt.Errorf("failed to build %s frontend packages: %v", edition, err)
		}

		log.Printf("Finished building %s frontend packages", string(edition))
		return nil
	}))
	return nil
}
