package resourcepermission

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateCreateAndUpdateInput(context.Background(), test.obj)
			if test.want == nil {
				assert.NoError(t, err)
			} else {
				assert.ErrorAs(t, test.want, &err)
			}
		})
	}
}
