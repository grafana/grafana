package jobs

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appjobs "github.com/grafana/grafana/apps/provisioning/pkg/jobs"
)

// AdmissionMutator attributes a Job to the acting user at creation time.
//
// It is the single entry point that enforces the user-attribution feature flag:
// the author annotations are only ever written here, from the request identity,
// and are cleared on every create so a client cannot spoof them. When
// attribution is disabled or the request is not made by a user (e.g. background
// sync or webhook jobs run under the provisioning identity), the job keeps the
// default commit author.
type AdmissionMutator struct{}

// NewAdmissionMutator creates a new job admission mutator.
func NewAdmissionMutator() *AdmissionMutator {
	return &AdmissionMutator{}
}

// Mutate stamps the author annotations on Job creation from the requesting user.
func (m *AdmissionMutator) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if a.GetOperation() != admission.Create {
		return nil
	}

	job, ok := a.GetObject().(*provisioning.Job)
	if !ok {
		return fmt.Errorf("expected job, got %T", a.GetObject())
	}

	// Never trust client-supplied author annotations: clear them first and set
	// them only from the request identity below. This guarantees the recorded
	// author always reflects who actually made the request.
	delete(job.Annotations, appjobs.AnnoAuthor)
	delete(job.Annotations, appjobs.AnnoAuthorEmail)
	delete(job.Annotations, appjobs.AnnoAuthorID)

	author, ok := UserAttribution(ctx)
	if !ok {
		return nil
	}

	if job.Annotations == nil {
		job.Annotations = map[string]string{}
	}
	if author.Name != "" {
		job.Annotations[appjobs.AnnoAuthor] = author.Name
	}
	if author.Email != "" {
		job.Annotations[appjobs.AnnoAuthorEmail] = author.Email
	}
	if author.ID != "" {
		job.Annotations[appjobs.AnnoAuthorID] = author.ID
	}

	return nil
}
