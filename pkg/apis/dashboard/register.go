package dashboard

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP      = "dashboard.grafana.app"
	VERSION    = runtime.APIVersionInternal
	APIVERSION = GROUP + "/" + VERSION

	// Resource constants
	DASHBOARD_RESOURCE     = "dashboards"
	LIBRARY_PANEL_RESOURCE = "librarypanels"
)

var DashboardResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	DASHBOARD_RESOURCE, "dashboard", "Dashboard",
	func() runtime.Object { return &Dashboard{} },
	func() runtime.Object { return &DashboardList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The dashboard name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			dash, ok := obj.(*Dashboard)
			if ok {
				if dash != nil {
					return []interface{}{
						dash.Name,
						dash.Spec.GetNestedString("title"),
						dash.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected dashboard")
		},
	},
)

var LibraryPanelResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	LIBRARY_PANEL_RESOURCE, "librarypanel", "LibraryPanel",
	func() runtime.Object { return &LibraryPanel{} },
	func() runtime.Object { return &LibraryPanelList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Description: "The dashboard name"},
			{Name: "Type", Type: "string", Description: "the panel type"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			dash, ok := obj.(*LibraryPanel)
			if ok {
				if dash != nil {
					return []interface{}{
						dash.Name,
						dash.Spec.Title,
						dash.Spec.Type,
						dash.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected library panel")
		},
	},
)

var (
	SchemeBuilder      = runtime.NewSchemeBuilder(addKnownTypes)
	AddToScheme        = SchemeBuilder.AddToScheme
	schemaGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)

func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(schemaGroupVersion,
		&Dashboard{},
		&DashboardList{},
		&DashboardWithAccessInfo{},
		&DashboardVersionList{},
		&VersionsQueryOptions{},
		&LibraryPanel{},
		&LibraryPanelList{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
	return nil
}
