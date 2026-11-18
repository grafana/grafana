package jobs

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type fakeCreateAuthorizer struct {
	err   error
	calls int
}

func (f *fakeCreateAuthorizer) AuthorizeJobCreate(context.Context, *provisioning.Job) error {
	f.calls++
	return f.err
}

func jobAttributes(job *provisioning.Job, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		job, nil, provisioning.JobResourceInfo.GroupVersionKind(),
		job.Namespace, job.Name, provisioning.JobResourceInfo.GroupVersionResource(), "",
		op, nil, false, nil,
	)
}

func TestAuthzValidator(t *testing.T) {
	job := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "job-1", Namespace: "default"},
		Spec:       provisioning.JobSpec{Action: provisioning.JobActionPull, Repository: "my-repo"},
	}
	forbidden := apierrors.NewForbidden(provisioning.JobResourceInfo.GroupResource(), "job-1", nil)

	t.Run("create returns the authorizer error", func(t *testing.T) {
		authz := &fakeCreateAuthorizer{err: forbidden}
		err := NewAuthzValidator(authz).Validate(context.Background(), jobAttributes(job, admission.Create), nil)
		require.True(t, apierrors.IsForbidden(err))
		require.Equal(t, 1, authz.calls)
	})

	t.Run("create is allowed when the authorizer allows it", func(t *testing.T) {
		authz := &fakeCreateAuthorizer{}
		err := NewAuthzValidator(authz).Validate(context.Background(), jobAttributes(job, admission.Create), nil)
		require.NoError(t, err)
		require.Equal(t, 1, authz.calls)
	})

	t.Run("service identity is not re-authorized", func(t *testing.T) {
		authz := &fakeCreateAuthorizer{err: forbidden}
		ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "default")
		require.NoError(t, err)
		require.NoError(t, NewAuthzValidator(authz).Validate(ctx, jobAttributes(job, admission.Create), nil))
		require.Zero(t, authz.calls)
	})

	t.Run("updates are not re-authorized when the spec is unchanged", func(t *testing.T) {
		authz := &fakeCreateAuthorizer{err: forbidden}
		labelled := job.DeepCopy()
		labelled.Labels = map[string]string{"provisioning.grafana.app/claim": "driver"}
		require.NoError(t, NewAuthzValidator(authz).Validate(context.Background(), jobUpdateAttributes(labelled, job), nil))
		require.Zero(t, authz.calls)
	})

	t.Run("spec change on update is rejected", func(t *testing.T) {
		changed := job.DeepCopy()
		changed.Spec.Action = provisioning.JobActionDelete
		err := NewAuthzValidator(&fakeCreateAuthorizer{}).Validate(context.Background(), jobUpdateAttributes(changed, job), nil)
		require.True(t, apierrors.IsForbidden(err))
	})

	t.Run("service identity may change the spec on update", func(t *testing.T) {
		changed := job.DeepCopy()
		changed.Spec.Action = provisioning.JobActionDelete
		ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "default")
		require.NoError(t, err)
		require.NoError(t, NewAuthzValidator(&fakeCreateAuthorizer{}).Validate(ctx, jobUpdateAttributes(changed, job), nil))
	})
}

func jobUpdateAttributes(job, old *provisioning.Job) admission.Attributes {
	return admission.NewAttributesRecord(
		job, old, provisioning.JobResourceInfo.GroupVersionKind(),
		job.Namespace, job.Name, provisioning.JobResourceInfo.GroupVersionResource(), "",
		admission.Update, nil, false, nil,
	)
}
