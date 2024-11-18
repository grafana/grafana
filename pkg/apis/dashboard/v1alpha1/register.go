package v1alpha1

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP      = "dashboard.grafana.app"
	VERSION    = "v1alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var DashboardResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"dashboards", "dashboard", "Dashboard",
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
	"librarypanels", "librarypanel", "LibraryPanel",
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
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
	schemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)

func init() {
	localSchemeBuilder.Register(addKnownTypes, addDefaultingFuncs)
}

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(schemeGroupVersion,
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
	metav1.AddToGroupVersion(scheme, schemeGroupVersion)
	return nil
}

func addDefaultingFuncs(scheme *runtime.Scheme) error {
	return RegisterDefaults(scheme)
}
