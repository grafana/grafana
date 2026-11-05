package admission

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func managedRepo(kind string) *provisioning.Repository {
	annotations := map[string]string{}
	if kind != "" {
		annotations[utils.AnnoKeyManagerKind] = kind
		annotations[utils.AnnoKeyManagerIdentity] = "some-manager"
	}
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Annotations: annotations},
	}
}

func newManagerKindAttributes(obj *provisioning.Repository, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		nil,
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		"default",
		"test-repo",
		provisioning.SchemeGroupVersion.WithResource("repositories"),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func TestValidateManagerKind(t *testing.T) {
	tests := []struct {
		name          string
		kind          string
		op            admission.Operation
		wantForbidden bool
	}{
		{name: "unmanaged create", op: admission.Create},
		{name: "terraform create", kind: string(utils.ManagerKindTerraform), op: admission.Create},
		{name: "kubectl create", kind: string(utils.ManagerKindKubectl), op: admission.Create},
		{name: "plugin create", kind: string(utils.ManagerKindPlugin), op: admission.Create},
		{name: "unrecognised manager kind create", kind: "something-else", op: admission.Create},
		{name: "repo create", kind: string(utils.ManagerKindRepo), op: admission.Create, wantForbidden: true},
		{name: "repo update", kind: string(utils.ManagerKindRepo), op: admission.Update, wantForbidden: true},
		{name: "repo delete", kind: string(utils.ManagerKindRepo), op: admission.Delete},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := managedRepo(tt.kind)
			meta, err := utils.MetaAccessor(repo)
			require.NoError(t, err)

			err = ValidateManagerKind(newManagerKindAttributes(repo, tt.op), meta)
			if !tt.wantForbidden {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)
			assert.Contains(t, err.Error(), utils.AnnoKeyManagerKind)
		})
	}
}
