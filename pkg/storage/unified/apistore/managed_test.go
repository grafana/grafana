package apistore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	authtypes "github.com/grafana/authlib/types"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestManagedAuthorizer(t *testing.T) {
	user := &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"}
	_, provisioner, err := identity.WithProvisioningIdentity(context.Background(), "default")
	require.NoError(t, err)

	tests := []struct {
		name string
		auth authtypes.AuthInfo
		obj  runtime.Object
		old  runtime.Object
		err  string
	}{
		{
			name: "user can create",
			auth: user,
			obj:  &unstructured.Unstructured{},
		},
		{
			name: "provisioning can create",
			auth: provisioner,
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "user can not create provisioned resource",
			auth: user,
			err:  "Provisioned resources must be manaaged by the provisioning service account",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "user can not update provisioned resource",
			auth: user,
			err:  "Provisioned resources must be manaaged by the provisioning service account",
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "provisioner can remove manager flags",
			auth: provisioner,
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
				},
			},
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
		{
			name: "provisioner can add manager flags",
			auth: provisioner,
			old: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 1,
				},
			},
			obj: &dashboard.Dashboard{
				ObjectMeta: v1.ObjectMeta{
					Generation: 2,
					Annotations: map[string]string{
						utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
						utils.AnnoKeyManagerIdentity: "abc",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj, err := utils.MetaAccessor(tt.obj)
			require.NoError(t, err)

			if tt.old == nil {
				err = checkManagerPropertiesOnCreate(tt.auth, obj)
			} else {
				old, _ := utils.MetaAccessor(tt.old)
				err = checkManagerPropertiesOnUpdateSpec(tt.auth, obj, old)
			}

			if tt.err != "" {
				require.Error(t, err, tt.err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
