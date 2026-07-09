package jobs

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// AnnoAuthor, AnnoAuthorEmail and AnnoAuthorID carry the display name, email
// and stable identity of the user that triggered the job. They are set by the
// server at creation time and are immutable.
const (
	AnnoAuthor      = "provisioning.grafana.app/author"
	AnnoAuthorEmail = "provisioning.grafana.app/authorEmail"
	AnnoAuthorID    = "provisioning.grafana.app/authorID"
)

// AdmissionMutator handles mutation for Job resources
type AdmissionMutator struct {
	userAttributionEnabled func(context.Context) bool
}

// NewAdmissionMutator creates a new job mutator. userAttributionEnabled reports
// whether author annotations should be kept and set for the current request.
func NewAdmissionMutator(userAttributionEnabled func(context.Context) bool) *AdmissionMutator {
	return &AdmissionMutator{userAttributionEnabled: userAttributionEnabled}
}

// Mutate applies mutations to Job resources
func (m *AdmissionMutator) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() != admission.Create {
		return nil
	}

	job, ok := obj.(*provisioning.Job)
	if !ok {
		return fmt.Errorf("expected job, got %T", obj)
	}

	if !m.userAttributionEnabled(ctx) {
		delete(job.Annotations, AnnoAuthor)
		delete(job.Annotations, AnnoAuthorEmail)
		delete(job.Annotations, AnnoAuthorID)
		return nil
	}

	for k, v := range AuthorAnnotations(ctx) {
		if job.Annotations == nil {
			job.Annotations = map[string]string{}
		}
		job.Annotations[k] = v
	}
	return nil
}

// AuthorAnnotations returns the author annotations for the user in ctx, or nil
// when the request is not made by a user.
func AuthorAnnotations(ctx context.Context) map[string]string {
	id, err := identity.GetRequester(ctx)
	if err != nil || !id.IsIdentityType(authlib.TypeUser) {
		return nil
	}
	annotations := map[string]string{}
	if name := id.GetName(); name != "" {
		annotations[AnnoAuthor] = name
	}
	if email := id.GetEmail(); email != "" {
		annotations[AnnoAuthorEmail] = email
	}
	if uid := id.GetUID(); uid != "" {
		annotations[AnnoAuthorID] = uid
	}
	return annotations
}
