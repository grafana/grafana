package admission

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	claims "github.com/grafana/authlib/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func fileProvisionedRepo(t *testing.T, title string, manager *utils.ManagerProperties) *provisioning.Repository {
	t.Helper()
	repo := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "bootstrap", Namespace: "default"},
		Spec:       provisioning.RepositorySpec{Title: title, Type: provisioning.LocalRepositoryType},
	}
	if manager != nil {
		meta, err := utils.MetaAccessor(repo)
		require.NoError(t, err)
		meta.SetManagerProperties(*manager)
	}
	return repo
}

func fileProvisioningManager() *utils.ManagerProperties {
	return &utils.ManagerProperties{Kind: utils.ManagerKindFileProvisioning, Identity: "bootstrap"}
}

func fileProvisionedAttributes(obj, old runtime.Object, op admission.Operation, subresource string) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		old,
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		"default",
		"bootstrap",
		provisioning.SchemeGroupVersion.WithResource("repositories"),
		subresource,
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestValidateFileProvisionedConfiguration(t *testing.T) {
	userCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{Type: claims.TypeUser, UserUID: "u1"})
	serviceAccountCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{Type: claims.TypeServiceAccount, UserUID: "sa1"})

	tests := []struct {
		name        string
		ctx         context.Context
		obj         runtime.Object
		old         runtime.Object
		op          admission.Operation
		subresource string
		wantErr     bool
	}{
		{
			name: "an in-process write is the reconciler's own",
			ctx:  context.Background(),
			obj:  fileProvisionedRepo(t, "Edited", fileProvisioningManager()),
			old:  fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			op:   admission.Update,
		},
		{
			name:    "a user cannot change the spec",
			ctx:     userCtx,
			obj:     fileProvisionedRepo(t, "Edited", fileProvisioningManager()),
			old:     fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			op:      admission.Update,
			wantErr: true,
		},
		{
			name:    "a service account cannot change the spec",
			ctx:     serviceAccountCtx,
			obj:     fileProvisionedRepo(t, "Edited", fileProvisioningManager()),
			old:     fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			op:      admission.Update,
			wantErr: true,
		},
		{
			name:    "a user cannot drop the manager",
			ctx:     userCtx,
			obj:     fileProvisionedRepo(t, "Provisioning configuration", nil),
			old:     fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			op:      admission.Update,
			wantErr: true,
		},
		{
			name: "a user cannot repoint the manager",
			ctx:  userCtx,
			obj: fileProvisionedRepo(t, "Provisioning configuration",
				&utils.ManagerProperties{Kind: utils.ManagerKindFileProvisioning, Identity: "elsewhere"}),
			old:     fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			op:      admission.Update,
			wantErr: true,
		},
		{
			name: "a user cannot grant it edits",
			ctx:  userCtx,
			obj: fileProvisionedRepo(t, "Provisioning configuration",
				&utils.ManagerProperties{Kind: utils.ManagerKindFileProvisioning, Identity: "bootstrap", AllowsEdits: true}),
			old:     fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			op:      admission.Update,
			wantErr: true,
		},
		{
			name: "a user may update a resource it does not own",
			ctx:  userCtx,
			obj:  fileProvisionedRepo(t, "Edited", &utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "bootstrap"}),
			old: fileProvisionedRepo(t, "Provisioning configuration",
				&utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "bootstrap"}),
			op: admission.Update,
		},
		{
			name: "a user may touch everything but the spec and the manager",
			ctx:  userCtx,
			obj:  fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			old:  fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			op:   admission.Update,
		},
		{
			name:    "a user cannot claim the provenance on create",
			ctx:     userCtx,
			obj:     fileProvisionedRepo(t, "Mine", fileProvisioningManager()),
			op:      admission.Create,
			wantErr: true,
		},
		{
			name: "a user may create an unmanaged repository",
			ctx:  userCtx,
			obj:  fileProvisionedRepo(t, "Mine", nil),
			op:   admission.Create,
		},
		{
			name: "deleting the leftover of a cleared setting stays available",
			ctx:  userCtx,
			old:  fileProvisionedRepo(t, "Provisioning configuration", fileProvisioningManager()),
			op:   admission.Delete,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := tt.obj
			if obj == nil {
				obj = tt.old
			}
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)

			err = ValidateFileProvisionedConfiguration(tt.ctx,
				fileProvisionedAttributes(tt.obj, tt.old, tt.op, tt.subresource), meta)

			if !tt.wantErr {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.True(t, apierrors.IsForbidden(err), "expected a Forbidden error, got %v", err)
		})
	}
}
