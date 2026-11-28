package jobs

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// CreateAuthorizer checks that the requesting user may queue the given job.
type CreateAuthorizer interface {
	AuthorizeJobCreate(ctx context.Context, job *provisioning.Job) error
}

// AuthzValidator applies the per-action authorization of the jobs connector to Jobs
// created through the generic CRUD store, which would otherwise only need the Editor role.
type AuthzValidator struct {
	authorizer CreateAuthorizer
}

func NewAuthzValidator(authorizer CreateAuthorizer) *AuthzValidator {
	return &AuthzValidator{authorizer: authorizer}
}

// Validate authorizes job creation and rejects spec changes on update, so a job
// cannot be changed after it was authorized. Service identities, such as the job
// driver and controllers, are trusted and not checked again.
func (v *AuthzValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if identity.IsServiceIdentity(ctx) {
		return nil
	}
	if op := a.GetOperation(); op != admission.Create && op != admission.Update {
		return nil
	}

	job, ok := a.GetObject().(*provisioning.Job)
	if !ok {
		return fmt.Errorf("expected job, got %T", a.GetObject())
	}

	switch a.GetOperation() {
	case admission.Create:
		return v.authorizer.AuthorizeJobCreate(ctx, job)
	case admission.Update:
		old, ok := a.GetOldObject().(*provisioning.Job)
		if !ok {
			return fmt.Errorf("expected old job, got %T", a.GetOldObject())
		}
		if !equality.Semantic.DeepEqual(old.Spec, job.Spec) {
			return apierrors.NewForbidden(provisioning.JobResourceInfo.GroupResource(), job.Name,
				errors.New("job spec is immutable"))
		}
	case admission.Delete, admission.Connect:
	}
	return nil
}
