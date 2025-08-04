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

var CoreRoleInfo = utils.NewResourceInfo(GROUP, VERSION,
	"coreroles", "corerole", "CoreRole",
	func() runtime.Object { return &CoreRole{} },
	func() runtime.Object { return &CoreRoleList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Group", Type: "string", Format: "group", Description: "Core role group"},
			{Name: "Title", Type: "string", Format: "string", Description: "Core role name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			core, ok := obj.(*CoreRole)
			if ok {
				if core != nil {
					return []interface{}{
						core.Name,
						core.Spec.Group,
						core.Spec.Title,
						core.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected core role")
		},
	},
)

var RoleInfo = utils.NewResourceInfo(GROUP, VERSION,
	"roles", "role", "Role",
	func() runtime.Object { return &Role{} },
	func() runtime.Object { return &RoleList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Group", Type: "string", Format: "group", Description: "Role group"},
			{Name: "Title", Type: "string", Format: "string", Description: "Role name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			role, ok := obj.(*Role)
			if ok {
				if role != nil {
					return []interface{}{
						role.Name,
						role.Spec.Group,
						role.Spec.Title,
						role.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected role")
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
		&CoreRole{},
		&CoreRoleList{},
		&Role{},
		&RoleList{},

		// What is this about?
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
	metav1.AddToGroupVersion(scheme, schemeGroupVersion)
	return nil
}

func addDefaultingFuncs(scheme *runtime.Scheme) error {
	// return RegisterDefaults(scheme)
	return nil
}
