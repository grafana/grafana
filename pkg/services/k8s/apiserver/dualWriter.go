package apiserver

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type DualWriter interface {
	// Called before the create storage
	Create(obj *unstructured.Unstructured) (*unstructured.Unstructured, error)

	// Called before update storage
	Update(obj *unstructured.Unstructured) (*unstructured.Unstructured, error)

	// Called before delete
	Delete(namespace string, name string) error

	// FUTURE??? some way to read/sync
}

type DualWriterProvider = func(kind string) DualWriter

// This offers a transition path where we write to SQL first, then into our k8s storage
type dashboardDualWriter struct {
	dashboardStore database.DashboardSQLStore
}

func (d *dashboardDualWriter) Create(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	fmt.Printf("TODO, CREATE dashboard in SQL storage (may be an update!): %s\n", obj.GetName())
	return obj, nil
}

func (d *dashboardDualWriter) Update(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	fmt.Printf("TODO, UPDATE dashboard in SQL storage (may be an update!): %s\n", obj.GetName())
	return obj, nil
}

func (d *dashboardDualWriter) Delete(namespace string, name string) error {
	fmt.Printf("TODO, DELETE %s/%s\n", namespace, name)
	return nil
}

type noopDualWriter struct{}

func (d *noopDualWriter) Create(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	return obj, nil
}

func (d *noopDualWriter) Update(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	return obj, nil
}

func (d *noopDualWriter) Delete(namespace string, name string) error {
	return nil
}
