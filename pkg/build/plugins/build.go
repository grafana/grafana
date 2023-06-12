package plugins

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/errutil"
	"github.com/grafana/grafana/pkg/build/syncutil"
	"github.com/grafana/grafana/pkg/infra/fs"
)

type PluginSigningMode = int

// BuildPlugins builds internal plugins.
// The built plugins are placed in plugins-bundled/dist/.
func Build(ctx context.Context, grafanaDir string, p syncutil.WorkerPool, g *errutil.Group, verMode *config.BuildConfig) error {
	log.Printf("Building plugins in %q...", grafanaDir)

	root := filepath.Join(grafanaDir, "plugins-bundled", "internal")
	fis, err := os.ReadDir(root)
	if err != nil {
		return err
	}

	for i := range fis {
		fi := fis[i]
		if !fi.IsDir() {
			continue
		}

		dpath := filepath.Join(root, fi.Name())

		p.Schedule(g.Wrap(func() error {
			log.Printf("Building plugin %q...", dpath)

			cmd := exec.Command("yarn", "build")
			cmd.Dir = dpath
			if output, err := cmd.CombinedOutput(); err != nil {
				return fmt.Errorf("yarn build failed: %s", output)
			}

			dstPath := filepath.Join("plugins-bundled", "dist", fi.Name())
			if err := fs.CopyRecursive(filepath.Join(dpath, "dist"), dstPath); err != nil {
				return err
			}
			if !verMode.PluginSignature.Sign {
				return nil
			}

			return BuildManifest(ctx, dstPath, verMode.PluginSignature.AdminSign)
		}))
	}

	if err := g.Wait(); err != nil {
		return err
	}

	log.Printf("Built all plug-ins successfully!")

	return nil
}
