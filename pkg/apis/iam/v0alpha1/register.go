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
	GROUP      = "iam.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var SSOSettingResourceInfo = utils.NewResourceInfo(
	GROUP, VERSION, "ssosettings", "ssosetting", "SSOSetting",
	func() runtime.Object { return &SSOSetting{} },
	func() runtime.Object { return &SSOSettingList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Source", Type: "string"},
			{Name: "Enabled", Type: "boolean"},
			{Name: "Created At", Type: "string", Format: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*SSOSetting)
			if !ok {
				return nil, fmt.Errorf("expected sso setting")
			}
			return []interface{}{
				m.Name,
				m.Spec.Source,
				m.Spec.Settings.GetNestedBool("enabled"),
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}

	// SchemaBuilder is used by standard codegen
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

// Adds the list of known types to the given scheme.
func AddKnownTypes(scheme *runtime.Scheme, version string) {
	scheme.AddKnownTypes(
		schema.GroupVersion{Group: GROUP, Version: version},
		&UserTeamList{},
		&ServiceAccountTokenList{},
		&DisplayList{},
		&SSOSetting{},
		&SSOSettingList{},
		&TeamMemberList{},
	)
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
