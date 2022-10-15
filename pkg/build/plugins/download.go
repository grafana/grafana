package plugins

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/build/errutil"
	"github.com/grafana/grafana/pkg/build/syncutil"
)

// logCloseError executes the closeFunc; if it returns an error, it is logged by the log package.
func logCloseError(closeFunc func() error) {
	if err := closeFunc(); err != nil {
		log.Println(err)
	}
}

// logCloseError executes the closeFunc; if it returns an error, it is logged by the log package.
func logError(err error) {
	if err != nil {
		log.Println(err)
	}
}

// pluginManifest has details of an external plugin package.
type pluginManifest struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Checksum string `json:"checksum"`
}

// pluginsManifest represents a manifest of Grafana's external plugins.
type pluginsManifest struct {
	Plugins []pluginManifest `json:"plugins"`
}

// downloadPlugins downloads Grafana plugins that should be bundled into packages.
//
// The plugin archives are downloaded into <grafanaDir>/plugins-bundled.
func Download(ctx context.Context, grafanaDir string, p syncutil.WorkerPool) error {
	g, _ := errutil.GroupWithContext(ctx)

	log.Println("Downloading external plugins...")

	var m pluginsManifest
	manifestPath := filepath.Join(grafanaDir, "plugins-bundled", "external.json")
	//nolint:gosec
	manifestB, err := os.ReadFile(manifestPath)
	if err != nil {
		return fmt.Errorf("failed to open plugins manifest %q: %w", manifestPath, err)
	}
	if err := json.Unmarshal(manifestB, &m); err != nil {
		return err
	}

	for i := range m.Plugins {
		pm := m.Plugins[i]
		p.Schedule(g.Wrap(func() error {
			tgt := filepath.Join(grafanaDir, "plugins-bundled", fmt.Sprintf("%s-%s.zip", pm.Name, pm.Version))
			//nolint:gosec
			out, err := os.Create(tgt)
			if err != nil {
				return err
			}
			defer logCloseError(out.Close)

			u := fmt.Sprintf("http://storage.googleapis.com/plugins-ci/plugins/%s/%s-%s.zip", pm.Name, pm.Name,
				pm.Version)
			log.Printf("Downloading plugin %q to %q...", u, tgt)
			// nolint:gosec
			resp, err := http.Get(u)
			if err != nil {
				return fmt.Errorf("downloading %q failed: %w", u, err)
			}
			defer logError(resp.Body.Close())

			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("failed to download %q, status code %d", u, resp.StatusCode)
			}

			if _, err := io.Copy(out, resp.Body); err != nil {
				return fmt.Errorf("downloading %q failed: %w", u, err)
			}
			if err := out.Close(); err != nil {
				return fmt.Errorf("downloading %q failed: %w", u, err)
			}

			//nolint:gosec
			fd, err := os.Open(tgt)
			if err != nil {
				return err
			}
			defer logCloseError(fd.Close)

			h := sha256.New()
			if _, err := io.Copy(h, fd); err != nil {
				return err
			}

			chksum := hex.EncodeToString(h.Sum(nil))
			if chksum != pm.Checksum {
				return fmt.Errorf("plugin %q has bad checksum: %s (expected %s)", u, chksum, pm.Checksum)
			}

			return Unzip(tgt, filepath.Join(grafanaDir, "plugins-bundled"))
		}))
	}

	return g.Wait()
}
