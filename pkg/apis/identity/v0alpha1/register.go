package v0alpha1

import (
	"fmt"
	"time"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP      = "identity.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var UserResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"users", "user", "User",
	func() runtime.Object { return &User{} },
	func() runtime.Object { return &UserList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Login", Type: "string", Format: "string", Description: "The user login"},
			{Name: "Email", Type: "string", Format: "string", Description: "The user email"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			u, ok := obj.(*User)
			if ok {
				return []interface{}{
					u.Name,
					u.Spec.Login,
					u.Spec.Email,
					u.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected user")
		},
	},
)

var TeamResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"teams", "team", "Team",
	func() runtime.Object { return &Team{} },
	func() runtime.Object { return &TeamList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The team name"},
			{Name: "Email", Type: "string", Format: "string", Description: "team email"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*Team)
			if !ok {
				return nil, fmt.Errorf("expected team")
			}
			return []interface{}{
				m.Name,
				m.Spec.Title,
				m.Spec.Email,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var ServiceAccountResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"serviceaccounts", "serviceaccount", "ServiceAccount",
	func() runtime.Object { return &ServiceAccount{} },
	func() runtime.Object { return &ServiceAccountList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Account", Type: "string", Format: "string", Description: "The service account email"},
			{Name: "Email", Type: "string", Format: "string", Description: "The user email"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			u, ok := obj.(*ServiceAccount)
			if ok {
				return []interface{}{
					u.Name,
					u.Spec.Name,
					u.Spec.Email,
					u.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected service account")
		},
	},
)

var SSOSettingResourceInfo = common.NewResourceInfo(
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

var TeamBindingResourceInfo = common.NewResourceInfo(
	GROUP, VERSION, "teambindings", "teambinding", "TeamBinding",
	func() runtime.Object { return &TeamBinding{} },
	func() runtime.Object { return &TeamBindingList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Team", Type: "string"},
			{Name: "Created At", Type: "string", Format: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*TeamBinding)
			if !ok {
				return nil, fmt.Errorf("expected team binding")
			}
			return []interface{}{
				m.Name,
				m.Spec.TeamRef.Name,
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
		&User{},
		&UserList{},
		&UserTeamList{},
		&ServiceAccount{},
		&ServiceAccountList{},
		&Team{},
		&TeamList{},
		&IdentityDisplayResults{},
		&SSOSetting{},
		&SSOSettingList{},
		&TeamBinding{},
		&TeamBindingList{},
		&TeamMemberList{},
	)
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
