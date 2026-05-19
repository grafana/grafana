package admission

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func newPendingDeleteAttributes(obj, old runtime.Object, op admission.Operation, subresource string) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		old,
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		"default",
		"test-repo",
		provisioning.SchemeGroupVersion.WithResource("repositories"),
		subresource,
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}

func pendingDeleteRepo(withLabel bool) *provisioning.Repository {
	labels := map[string]string{}
	if withLabel {
		labels[appcontroller.LabelPendingDelete] = "true"
	}
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo", Labels: labels},
	}
}

func TestValidatePendingDeletion(t *testing.T) {
	tests := []struct {
		name          string
		obj           runtime.Object
		old           runtime.Object
		op            admission.Operation
		subresource   string
		wantErr       bool
		wantForbidden bool
	}{
		{
			name:    "Create without pending-delete label is allowed",
			obj:     pendingDeleteRepo(false),
			op:      admission.Create,
			wantErr: false,
		},
		{
			name:          "Create with pending-delete label is forbidden",
			obj:           pendingDeleteRepo(true),
			op:            admission.Create,
			wantErr:       true,
			wantForbidden: true,
		},
		{
			name:    "Update: old without label, new without label is allowed",
			obj:     pendingDeleteRepo(false),
			old:     pendingDeleteRepo(false),
			op:      admission.Update,
			wantErr: false,
		},
		{
			name:    "Update: old with label, new without label is allowed (explicit unlock)",
			obj:     pendingDeleteRepo(false),
			old:     pendingDeleteRepo(true),
			op:      admission.Update,
			wantErr: false,
		},
		{
			name:    "Update: old without label, new with label is allowed (label being set)",
			obj:     pendingDeleteRepo(true),
			old:     pendingDeleteRepo(false),
			op:      admission.Update,
			wantErr: false,
		},
		{
			name:          "Update: both old and new have pending-delete label is forbidden",
			obj:           pendingDeleteRepo(true),
			old:           pendingDeleteRepo(true),
			op:            admission.Update,
			wantErr:       true,
			wantForbidden: true,
		},
		{
			name:        "Update status subresource: both have pending-delete label is allowed",
			obj:         pendingDeleteRepo(true),
			old:         pendingDeleteRepo(true),
			op:          admission.Update,
			subresource: "status",
			wantErr:     false,
		},
		{
			name:        "Update status subresource: old with label, new with label is allowed",
			obj:         pendingDeleteRepo(true),
			old:         pendingDeleteRepo(true),
			op:          admission.Update,
			subresource: "status",
			wantErr:     false,
		},
		{
			name:    "Delete operation is not checked",
			obj:     pendingDeleteRepo(true),
			op:      admission.Delete,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attr := newPendingDeleteAttributes(tt.obj, tt.old, tt.op, tt.subresource)
			meta, err := utils.MetaAccessor(tt.obj)
			require.NoError(t, err)

			gotErr := ValidatePendingDeletion(attr, meta)

			if tt.wantErr {
				require.Error(t, gotErr)
				if tt.wantForbidden {
					assert.Contains(t, gotErr.Error(), "namespace is pending deletion")
				}
			} else {
				assert.NoError(t, gotErr)
			}
		})
	}
}
