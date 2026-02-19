package v0alpha1

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP      = "customtheme.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var CustomThemeResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"customthemes", "customtheme", "CustomTheme",
	func() runtime.Object { return &CustomTheme{} },
	func() runtime.Object { return &CustomThemeList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "User UID", Type: "string", Format: "string", Description: "The user who created the theme (empty = global)"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*CustomTheme)
			if !ok {
				return nil, fmt.Errorf("expected custom theme")
			}
			return []interface{}{
				m.Name,
				m.Spec.UserUID,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var (
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}

	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

func init() {
	localSchemeBuilder.Register(addKnownTypes)
}

func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&CustomTheme{},
		&CustomThemeList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}

func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
