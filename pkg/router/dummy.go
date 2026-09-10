package router

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
)

type dummyRoutesLoader struct {
	groups []string
}

func (d dummyRoutesLoader) Load(context.Context) ([]Backend, error) {
	backends := make([]Backend, 0, len(d.groups))
	for _, group := range d.groups {
		backends = append(backends, &dummyBackend{group: group})
	}
	return backends, nil
}

func (dummyRoutesLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

type dummyBackend struct {
	group string
}

func (d *dummyBackend) Group() string {
	return d.group
}

func (d *dummyBackend) Load(context.Context) (http.Handler, error) {
	return d, nil
}

func (d *dummyBackend) Manifest() app.ManifestData {
	return app.ManifestData{
		Group: d.group,
		Versions: []app.ManifestVersion{
			{
				Name:   "v0alpha1",
				Served: true,
				Kinds: []app.ManifestVersionKind{
					{
						Kind:   "x",
						Plural: "xs",
						Scope:  "namespaced",
					},
				},
			},
			{
				Name:   "v0alpha2",
				Served: true,
			},
			{
				Name:   "v0alpha3",
				Served: false,
			},
		},
	}
}

func (d *dummyBackend) RV() string {
	return "static"
}

func (d *dummyBackend) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	_, _ = fmt.Fprint(w, "dummy backend for group: ", d.group)
}
