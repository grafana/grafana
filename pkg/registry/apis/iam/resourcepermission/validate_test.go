package resourcepermission

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func TestValidateOnCreate(t *testing.T) {
	tests := []struct {
		name string
		obj  *iamv0alpha1.ResourcePermission
		want error
	}{
		{
			name: "missing permissions - should fail",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{
					Name: "folder.grafana.app-folders-test_folder",
				},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "folder.grafana.app",
						Resource: "folders",
						Name:     "test_folder",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{},
				},
			},
			want: errInvalidSpec,
		},
		{
			name: "invalid name - should fail",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{
					Name: "some-invalid-name",
				},
			},
			want: errInvalidName,
		},
		{
			name: "wildcard resource name - should fail",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{
					Name: "folder.grafana.app-folders-*",
				},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "folder.grafana.app",
						Resource: "folders",
						Name:     "*",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
							Name: "Editor",
							Verb: "edit",
						},
					},
				},
			},
			want: errInvalidSpec,
		},
		{
			name: "mismatched name and spec - should fail",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{
					Name: "folder.grafana.app-folders-test_folder",
				},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "folder.grafana.app",
						Resource: "folders",
						Name:     "some_other_folder",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindUser,
							Name: "test-user",
							Verb: "view",
						},
					},
				},
			},
			want: errInvalidSpec,
		},
		{
			name: "valid spec - should pass",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{
					Name: "folder.grafana.app-folders-test_folder",
				},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "folder.grafana.app",
						Resource: "folders",
						Name:     "test_folder",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
							Name: "Editor",
							Verb: "edit",
						},
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
							Name: "Viewer", // Different entity name - should be allowed
							Verb: "view",
						},
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindUser,
							Name: "user-1",
							Verb: "edit", // Different kind - should be allowed
						},
					},
				},
			},
			want: nil,
		},
		{
			name: "duplicate entities - should fail",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{
					Name: "dashboard.grafana.app-dashboards-test_dashboard",
				},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "dashboard.grafana.app",
						Resource: "dashboards",
						Name:     "test_dashboard",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
							Name: "Editor",
							Verb: "edit",
						},
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
							Name: "Editor",
							Verb: "view", // Same entity, different verb - should fail
						},
					},
				},
			},
			want: errInvalidSpec,
		},
		{
			name: "duplicate names but different kinds - should pass",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{
					Name: "dashboard.grafana.app-dashboards-test_dashboard",
				},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "dashboard.grafana.app",
						Resource: "dashboards",
						Name:     "test_dashboard",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindUser,
							Name: "Editor",
							Verb: "edit",
						},
						{
							Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
							Name: "Editor",
							Verb: "view",
						},
					},
				},
			},
			want: nil,
		},
	}

	mappers := NewMappersRegistry()
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateCreateAndUpdateInput(context.Background(), test.obj, mappers)
			if test.want == nil {
				assert.NoError(t, err)
			} else {
				assert.ErrorAs(t, test.want, &err)
			}
		})
	}
}

func TestValidateOnCreate_KindAndVerbRestrictions(t *testing.T) {
	mappers := NewMappersRegistry()
	mappers.RegisterMapper(
		schema.GroupResource{Group: "iam.grafana.app", Resource: "serviceaccounts"},
		NewMapperWithAttribute("serviceaccounts", []string{"Edit", "Admin"}, ScopeAttributeID,
			[]iamv0alpha1.ResourcePermissionSpecPermissionKind{
				iamv0alpha1.ResourcePermissionSpecPermissionKindUser,
				iamv0alpha1.ResourcePermissionSpecPermissionKindServiceAccount,
				iamv0alpha1.ResourcePermissionSpecPermissionKindTeam,
			}),
		nil,
	)

	tests := []struct {
		name    string
		obj     *iamv0alpha1.ResourcePermission
		wantErr bool
	}{
		{
			name: "serviceaccount with BasicRole kind - should fail",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{Name: "iam.grafana.app-serviceaccounts-sa-abc123"},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "iam.grafana.app",
						Resource: "serviceaccounts",
						Name:     "sa-abc123",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "edit"},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "serviceaccount with view verb - should fail",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{Name: "iam.grafana.app-serviceaccounts-sa-abc123"},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "iam.grafana.app",
						Resource: "serviceaccounts",
						Name:     "sa-abc123",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindUser, Name: "user-uid-xyz", Verb: "view"},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "serviceaccount with User kind and edit verb - should pass",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{Name: "iam.grafana.app-serviceaccounts-sa-abc123"},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "iam.grafana.app",
						Resource: "serviceaccounts",
						Name:     "sa-abc123",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindUser, Name: "user-uid-xyz", Verb: "edit"},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "serviceaccount with Team kind and admin verb - should pass",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{Name: "iam.grafana.app-serviceaccounts-sa-abc123"},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "iam.grafana.app",
						Resource: "serviceaccounts",
						Name:     "sa-abc123",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindTeam, Name: "team-uid-abc", Verb: "admin"},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "folder with BasicRole kind - should still pass (no kind restriction)",
			obj: &iamv0alpha1.ResourcePermission{
				ObjectMeta: v1.ObjectMeta{Name: "folder.grafana.app-folders-test_folder"},
				Spec: iamv0alpha1.ResourcePermissionSpec{
					Resource: iamv0alpha1.ResourcePermissionspecResource{
						ApiGroup: "folder.grafana.app",
						Resource: "folders",
						Name:     "test_folder",
					},
					Permissions: []iamv0alpha1.ResourcePermissionspecPermission{
						{Kind: iamv0alpha1.ResourcePermissionSpecPermissionKindBasicRole, Name: "Editor", Verb: "edit"},
					},
				},
			},
			wantErr: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateCreateAndUpdateInput(context.Background(), test.obj, mappers)
			if test.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateDeleteInput(t *testing.T) {
	tests := []struct {
		name    string
		objName string
		want    error
	}{
		{
			name:    "invalid name - should fail",
			objName: "some-invalid-name",
			want:    errInvalidName,
		},
		{
			name:    "wildcard resource name - should fail",
			objName: "folder.grafana.app-folders-*",
			want:    errInvalidSpec,
		},
		{
			name:    "enabled group/resource (folder) - should pass",
			objName: "folder.grafana.app-folders-test_folder",
			want:    nil,
		},
		{
			name:    "enabled group/resource (dashboard) - should pass",
			objName: "dashboard.grafana.app-dashboards-test_dashboard",
			want:    nil,
		},
		{
			name:    "disabled group/resource - should fail",
			objName: "disabled.grafana.app-resources-test_resource",
			want:    errUnknownGroupResource,
		},
		{
			name:    "unknown group/resource - should fail",
			objName: "unknown.group-app-resources-test",
			want:    errUnknownGroupResource,
		},
	}

	mappers := NewMappersRegistry()
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateDeleteInput(context.Background(), test.objName, mappers)
			if test.want == nil {
				assert.NoError(t, err)
			} else {
				assert.ErrorAs(t, test.want, &err)
			}
		})
	}
}
