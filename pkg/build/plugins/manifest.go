package plugins

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

type manifest struct {
	Plugin  string            `json:"plugin"`
	Version string            `json:"version"`
	Files   map[string]string `json:"files"`
}

func getManifest(dpath string, chksums map[string]string) (manifest, error) {
	m := manifest{}

	type pluginInfo struct {
		Version string `json:"version"`
	}

	type plugin struct {
		ID   string     `json:"id"`
		Info pluginInfo `json:"info"`
	}

	//nolint:gosec
	f, err := os.Open(filepath.Join(dpath, "plugin.json"))
	if err != nil {
		return m, err
	}
	decoder := json.NewDecoder(f)
	var p plugin
	if err := decoder.Decode(&p); err != nil {
		return m, err
	}

	if p.ID == "" {
		return m, fmt.Errorf("plugin.json doesn't define id")
	}
	if p.Info.Version == "" {
		return m, fmt.Errorf("plugin.json doesn't define info.version")
	}

	return manifest{
		Plugin:  p.ID,
		Version: p.Info.Version,
		Files:   chksums,
	}, nil
}

// BuildManifest requests a plugin's signed manifest file fromt he Grafana API.
// If signingAdmin is true, the manifest signing admin endpoint (without plugin ID) will be used, and requires
// an admin API key.
func BuildManifest(ctx context.Context, dpath string, signingAdmin bool) error {
	log.Printf("Building manifest for plug-in at %q", dpath)

	apiKey := os.Getenv("GRAFANA_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("GRAFANA_API_KEY must be set")
	}

	manifestPath := filepath.Join(dpath, "MANIFEST.txt")
	chksums, err := getChksums(dpath, manifestPath)
	if err != nil {
		return err
	}
	m, err := getManifest(dpath, chksums)
	if err != nil {
		return err
	}

	b := bytes.NewBuffer(nil)
	encoder := json.NewEncoder(b)
	if err := encoder.Encode(&m); err != nil {
		return err
	}
	jsonB := b.Bytes()
	u := "https://grafana.com/api/plugins/ci/sign"
	if !signingAdmin {
		u = fmt.Sprintf("https://grafana.com/api/plugins/%s/ci/sign", m.Plugin)
	}
	log.Printf("Requesting signed manifest from Grafana API...")
	req, err := http.NewRequestWithContext(ctx, "POST", u, bytes.NewReader(jsonB))
	if err != nil {
		return err
	}
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	req.Header.Add("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to get signed manifest from Grafana API: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Println("failed to close response body, err: %w", err)
		}
	}()
	if resp.StatusCode != 200 {
		msg, err := io.ReadAll(resp.Body)
		if err != nil {
			log.Printf("Failed to read response body: %s", err)
			msg = []byte("")
		}
		return fmt.Errorf("request for signed manifest failed with status code %d: %s", resp.StatusCode, string(msg))
	}

	log.Printf("Successfully signed manifest via Grafana API, writing to %q", manifestPath)
	//nolint:gosec
	f, err := os.Create(manifestPath)
	if err != nil {
		return fmt.Errorf("failed to create %s: %w", manifestPath, err)
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Println("failed to close file, err: %w", err)
		}
	}()
	if _, err := io.Copy(f, resp.Body); err != nil {
		return fmt.Errorf("failed to write %s: %w", manifestPath, err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("failed to write %s: %w", manifestPath, err)
	}

	return nil
}

func getChksums(dpath, manifestPath string) (map[string]string, error) {
	manifestPath = filepath.Clean(manifestPath)

	chksums := map[string]string{}
	if err := filepath.Walk(dpath, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if fi.IsDir() {
			return nil
		}

		path = filepath.Clean(path)

		// Handle symbolic links
		if fi.Mode()&os.ModeSymlink == os.ModeSymlink {
			finalPath, err := filepath.EvalSymlinks(path)
			if err != nil {
				return err
			}

			log.Printf("Handling symlink %q, pointing to %q", path, finalPath)

			info, err := os.Stat(finalPath)
			if err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}

			if _, err := filepath.Rel(dpath, finalPath); err != nil {
				return fmt.Errorf("symbolic link %q targets a file outside of the plugin directory: %q", path, finalPath)
			}

			if finalPath == manifestPath {
				return nil
			}
		}

		if path == manifestPath {
			return nil
		}

		h := sha256.New()
		//nolint:gosec
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer logCloseError(f.Close)
		if _, err := io.Copy(h, f); err != nil {
			return err
		}

		relPath, err := filepath.Rel(dpath, path)
		if err != nil {
			return err
		}
		chksums[relPath] = fmt.Sprintf("%x", h.Sum(nil))

		return nil
	}); err != nil {
		return nil, err
	}

	return chksums, nil
}
