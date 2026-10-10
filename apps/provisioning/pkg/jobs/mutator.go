package jobs

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/authlib/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// AdmissionMutator attributes a Job to the acting user at creation time.
//
// Attribution comes from the request identity so clients cannot spoof it. The
// provisioning service may preserve webhook attribution, but never its email,
// so background and webhook jobs keep the default commit author.
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

	if job.Annotations == nil {
		job.Annotations = map[string]string{}
	}
	// Never let a caller set the email annotation
	delete(job.Annotations, AnnoAuthorEmail)

	requester, err := identity.GetRequester(ctx)
	isUser := err == nil && requester.IsIdentityType(types.TypeUser)

	if isUser {
		job.Annotations[AnnoAuthor] = requester.GetName()
		job.Annotations[AnnoAuthorEmail] = requester.GetEmail()
		job.Annotations[AnnoAuthorID] = requester.GetUID()
		job.Annotations[AnnoAuthorOrigin] = "Grafana"
		return nil
	}

	info, hasInfo := types.AuthInfoFrom(ctx)
	isProvisioningService := hasInfo && identity.IsProvisioningServiceIdentity(info)

	if isProvisioningService {
		if job.Annotations[AnnoAuthorOrigin] == "" {
			job.Annotations[AnnoAuthorOrigin] = "Grafana"
		}
		return nil
	}

	delete(job.Annotations, AnnoAuthor)
	delete(job.Annotations, AnnoAuthorID)
	delete(job.Annotations, AnnoAuthorOrigin)

	return nil
}
