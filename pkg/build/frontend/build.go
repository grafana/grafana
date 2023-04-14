package frontend

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"

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

// Build builds the Grafana front-end
func Build(edition config.Edition, grafanaDir string, p syncutil.WorkerPool, g *errutil.Group) error {
	log.Printf("Building %s frontend in %q", edition, grafanaDir)
	grafanaDir, err := filepath.Abs(grafanaDir)
	if err != nil {
		return err
	}

	for _, dpath := range []string{"tmp", "public_gen", "public/build"} {
		dpath = filepath.Join(grafanaDir, dpath)
		if err := os.RemoveAll(dpath); err != nil {
			return fmt.Errorf("failed to remove %q: %w", dpath, err)
		}
	}

	p.Schedule(g.Wrap(func() error {
		cmd := exec.Command("yarn", "run", "build")
		cmd.Dir = grafanaDir
		if output, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to build %s frontend with webpack: %s", edition, output)
		}

		log.Printf("Finished building %s frontend", edition)
		return nil
	}))

	return nil
}
