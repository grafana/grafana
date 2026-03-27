// This package is a thin wrapper around v1, since v1beta1 and v1 have identical schemas.
// This eliminates code duplication while maintaining backward compatibility.

package v1beta1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	v1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP      = "dashboard.grafana.app"
	VERSION    = "v1beta1"
	APIVERSION = GROUP + "/" + VERSION

	// Resource constants
	DASHBOARD_RESOURCE     = "dashboards"
	LIBRARY_PANEL_RESOURCE = "librarypanels"
)

// Type aliases - v1beta1 and v1 have identical schemas, so we re-use all types directly.
type (
	Dashboard                 = v1.Dashboard
	DashboardList             = v1.DashboardList
	DashboardSpec             = v1.DashboardSpec
	DashboardStatus           = v1.DashboardStatus
	DashboardConversionStatus = v1.DashboardConversionStatus
	DashboardWithAccessInfo   = v1.DashboardWithAccessInfo
	DashboardAccess           = v1.DashboardAccess
	AnnotationPermission      = v1.AnnotationPermission
	AnnotationActions         = v1.AnnotationActions
	DashboardClient           = v1.DashboardClient
	DashboardJSONCodec        = v1.DashboardJSONCodec
)

var (
	NewDashboard                    = v1.NewDashboard
	NewDashboardSpec                = v1.NewDashboardSpec
	NewDashboardStatus              = v1.NewDashboardStatus
	NewDashboardClient              = v1.NewDashboardClient
	NewDashboardClientFromGenerator = v1.NewDashboardClientFromGenerator

	DashboardKind         = v1.DashboardKind
	DashboardSchema       = v1.DashboardSchema
	GetOpenAPIDefinitions = v1.GetOpenAPIDefinitions
	ValidateDashboardSpec = v1.ValidateDashboardSpec
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

var (
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
	schemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)

func init() {
	localSchemeBuilder.Register(addKnownTypes)
}

// addKnownTypes registers v1 types under the v1beta1 group version.
// Since v1beta1 and v1 have identical schemas, the same Go types serve both API versions.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(schemeGroupVersion,
		&Dashboard{},
		&DashboardList{},
		&DashboardWithAccessInfo{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
	metav1.AddToGroupVersion(scheme, schemeGroupVersion)
	return nil
}
