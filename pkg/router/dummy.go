package router

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
)

type dummyRoutesLoader struct {
	group []string
}

func (d dummyRoutesLoader) Load(context.Context) ([]Backend, error) {
	backends := make([]Backend, 0, len(d.group))
	for _, g := range d.group {
		backends = append(backends, &dummyBackend{group: g})
	}
	return backends, nil
}

func (dummyRoutesLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

type dummyBackend struct {
	group string
}

// Group implements [Backend].
func (d *dummyBackend) Group() string {
	return d.group
}

// Load implements [Backend].
func (d *dummyBackend) Load(context.Context) (http.Handler, error) {
	return d, nil
}

// Manifest implements [Backend].
func (d *dummyBackend) Manifest() app.ManifestData {
	return app.ManifestData{
		Group: d.group,
		Versions: []app.ManifestVersion{{
			Name: "v0alpha1",
		}, {
			Name: "v0alpha2",
		}},
	}
}

// RV implements [Backend].
func (d *dummyBackend) RV() string {
	return "static"
}

// ServeHTTP implements [http.Handler].
func (d *dummyBackend) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	_, _ = fmt.Fprint(w, "dummy backend for group: ", d.group)
}
