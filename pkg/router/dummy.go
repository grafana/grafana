package router

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

func (d *dummyBackend) Group() metav1.APIGroup {
	return metav1.APIGroup{
		Name: d.group,
		Versions: []metav1.GroupVersionForDiscovery{{
			GroupVersion: fmt.Sprintf("%s/v0alpha1", d.group),
			Version:      "v0alpha1",
		}, {
			GroupVersion: fmt.Sprintf("%s/v0alpha2", d.group),
			Version:      "v0alpha2",
		}},
	}
}

func (d *dummyBackend) Load(context.Context) (http.Handler, error) {
	return d, nil
}

func (d *dummyBackend) Key() string {
	return "static"
}

func (d *dummyBackend) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	_, _ = fmt.Fprint(w, "dummy backend for group: ", d.group)
}
