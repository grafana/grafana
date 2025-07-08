package v0alpha1

import (
	"fmt"
	"strings"
	"time"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
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

var userKind = iamv0alpha1.UserKind()
var UserResourceInfo = utils.NewResourceInfo(userKind.Group(), userKind.Version(),
	userKind.GroupVersionResource().Resource, strings.ToLower(userKind.Kind()), userKind.Kind(),
	func() runtime.Object { return userKind.ZeroValue() },
	func() runtime.Object { return userKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Login", Type: "string", Format: "string", Description: "The user login"},
			{Name: "Email", Type: "string", Format: "string", Description: "The user email"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			u, ok := obj.(*iamv0alpha1.User)
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

var teamKind = iamv0alpha1.TeamKind()
var TeamResourceInfo = utils.NewResourceInfo(teamKind.Group(), teamKind.Version(),
	teamKind.GroupVersionResource().Resource, strings.ToLower(teamKind.Kind()), teamKind.Kind(),
	func() runtime.Object { return teamKind.ZeroValue() },
	func() runtime.Object { return teamKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The team name"},
			{Name: "Email", Type: "string", Format: "string", Description: "team email"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*iamv0alpha1.Team)
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

var serviceAccountKind = iamv0alpha1.ServiceAccountKind()
var ServiceAccountResourceInfo = utils.NewResourceInfo(serviceAccountKind.Group(), serviceAccountKind.Version(),
	serviceAccountKind.GroupVersionResource().Resource, strings.ToLower(serviceAccountKind.Kind()), serviceAccountKind.Kind(),
	func() runtime.Object { return serviceAccountKind.ZeroValue() },
	func() runtime.Object { return serviceAccountKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string"},
			{Name: "Disabled", Type: "boolean"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			sa, ok := obj.(*iamv0alpha1.ServiceAccount)
			if ok {
				return []interface{}{
					sa.Name,
					sa.Spec.Title,
					sa.Spec.Disabled,
					sa.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected service account")
		},
	},
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

var teamBindingKind = iamv0alpha1.TeamBindingKind()
var TeamBindingResourceInfo = utils.NewResourceInfo(
	teamBindingKind.Group(), teamBindingKind.Version(),
	teamBindingKind.GroupVersionResource().Resource,
	strings.ToLower(teamBindingKind.Kind()), teamBindingKind.Kind(),
	func() runtime.Object { return teamBindingKind.ZeroValue() },
	func() runtime.Object { return teamBindingKind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Team", Type: "string"},
			{Name: "Created At", Type: "string", Format: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*iamv0alpha1.TeamBinding)
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
		&iamv0alpha1.User{},
		&iamv0alpha1.UserList{},
		&UserTeamList{},
		&iamv0alpha1.ServiceAccount{},
		&iamv0alpha1.ServiceAccountList{},
		&ServiceAccountTokenList{},
		&iamv0alpha1.Team{},
		&iamv0alpha1.TeamList{},
		&DisplayList{},
		&SSOSetting{},
		&SSOSettingList{},
		&iamv0alpha1.TeamBinding{},
		&iamv0alpha1.TeamBindingList{},
		&TeamMemberList{},
	)
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
