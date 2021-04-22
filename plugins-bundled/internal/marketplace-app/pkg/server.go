package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

type server struct {
	logger log.Logger
}

func (srv *server) registerRoutes(r chi.Router) {
	adminRoutes := r.With(roleAuth("Admin"))
	adminRoutes.Post("/install", srv.install)
	adminRoutes.Post("/uninstall", srv.uninstall)

	r.Get("/installed", srv.installed)
	r.Get("/*", srv.api)
}

func (srv *server) install(w http.ResponseWriter, r *http.Request) {
	var data struct {
		URL       string `json:"url"`
		PluginDir string `json:"pluginDir"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		srv.logger.Error(err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if data.PluginDir == "" {
		data.PluginDir = "/var/lib/grafana/plugins"
	}

	if data.URL == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "missing url"})
		return
	}

	resp, err := http.Get(data.URL)
	if err != nil {
		srv.logger.Error(err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	b, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		srv.logger.Error(err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if err := srv.extractPlugin(bytes.NewReader(b), data.PluginDir); err != nil {
		srv.logger.Error(err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func (srv *server) uninstall(w http.ResponseWriter, r *http.Request) {
	var data struct {
		Slug      string `json:"slug"`
		PluginDir string `json:"pluginDir"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		srv.logger.Error(err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if data.Slug == "" || data.PluginDir == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	pluginPath := filepath.Join(data.PluginDir, data.Slug)

	// Offers a little safe-guard so that users don't risk removing things by accident.
	if _, err := os.Stat(filepath.Join(pluginPath, "plugin.json")); err != nil {
		if os.IsNotExist(err) {
			if _, err := os.Stat(filepath.Join(pluginPath, "dist", "plugin.json")); err != nil {
				if os.IsNotExist(err) {
					srv.logger.Error(fmt.Sprintf("Tried to remove %q, but it doesn't seem to be a plugin", pluginPath))
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				srv.logger.Error(err.Error())
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		} else {
			srv.logger.Error(err.Error())
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	}

	srv.logger.Info("Uninstalling plugin", "id", data.Slug)
	if err := os.RemoveAll(filepath.Join(data.PluginDir, data.Slug)); err != nil {
		srv.logger.Error(err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func (srv *server) installed(w http.ResponseWriter, r *http.Request) {
	pluginDir := r.URL.Query().Get("pluginDir")
	if pluginDir == "" {
		pluginDir = "/var/lib/grafana/plugins"
	}

	type plugin struct {
		ID   string `json:"id"`
		Info struct {
			Version string `json:"version"`
			Links   []struct {
				Name string `json:"name"`
				URL  string `json:"url"`
			} `json:"links"`
		} `json:"info"`
		Development bool `json:"dev"`
	}

	plugins := []plugin{}

	matches, err := filepath.Glob(pluginDir + "/*")
	if err != nil {
		srv.logger.Error(err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	for _, match := range matches {
		fi, err := os.Stat(match)
		if err != nil {
			srv.logger.Error(err.Error())
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		if !fi.IsDir() {
			continue
		}

		var metadata plugin

		if err := read(filepath.Join(match, "plugin.json"), &metadata); err != nil {
			if os.IsNotExist(err) {
				if err := read(filepath.Join(match, "dist", "plugin.json"), &metadata); err != nil {
					if os.IsNotExist(err) {
						continue
					} else {
						srv.logger.Error(err.Error())
						w.WriteHeader(http.StatusInternalServerError)
						return
					}
				}
			} else {
				srv.logger.Error(err.Error())
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		}

		_, err = os.Stat(filepath.Join(match, ".git"))
		if err == nil {
			metadata.Development = true
		}

		plugins = append(plugins, metadata)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(plugins); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func read(path string, body interface{}) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	return json.NewDecoder(f).Decode(body)
}

// api proxies requests to the Grafana.com API.
func (srv *server) api(w http.ResponseWriter, r *http.Request) {
	resp, err := http.Get("https://grafana.com/api" + r.URL.Path)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if _, err := io.Copy(w, resp.Body); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.WriteHeader(resp.StatusCode)
}

func (srv *server) extractPlugin(body io.Reader, output string) error {
	zipball, err := ioutil.TempFile("", "")
	if err != nil {
		return err
	}
	defer func() {
		zipball.Close()
		os.Remove(zipball.Name())
	}()

	if _, err := io.Copy(zipball, body); err != nil {
		return err
	}

	filenames, err := unzip(zipball.Name(), output)
	if err != nil {
		return err
	}

	var metadataPath string
	for _, filename := range filenames {
		if filepath.Base(filename) == "plugin.json" {
			metadataPath = filename
		}
	}

	segments := strings.Split(strings.TrimPrefix(metadataPath, output+"/"), "/")

	var metadata struct {
		ID string `json:"id"`
	}
	if err := read(metadataPath, &metadata); err != nil {
		return err
	}

	dir := segments[0]

	if dir != "" && dir != metadata.ID {
		if err := os.Rename(filepath.Join(output+"/", dir), filepath.Join(output+"/", metadata.ID)); err != nil {
			return err
		}
	}

	return err
}

func unzip(src string, dest string) ([]string, error) {
	var filenames []string

	r, err := zip.OpenReader(src)
	if err != nil {
		return filenames, err
	}
	defer r.Close()

	for _, f := range r.File {
		// Store filename/path for returning and using later on
		fpath := filepath.Join(dest, f.Name)

		// Check for ZipSlip. More Info: http://bit.ly/2MsjAWE
		if !strings.HasPrefix(fpath, filepath.Clean(dest)+string(os.PathSeparator)) {
			return filenames, fmt.Errorf("%s: illegal file path", fpath)
		}

		filenames = append(filenames, fpath)

		if f.FileInfo().IsDir() {
			// Make Folder
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		// Make File
		if err = os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return filenames, err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return filenames, err
		}

		rc, err := f.Open()
		if err != nil {
			return filenames, err
		}

		_, err = io.Copy(outFile, rc)

		// Close the file without defer to close before next iteration of loop
		outFile.Close()
		rc.Close()

		if err != nil {
			return filenames, err
		}
	}
	return filenames, nil
}

// roleAuth is a middleware function that checks whether a request has the required role.
func roleAuth(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := httpadapter.UserFromContext(r.Context())
			if user.Role != role {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
