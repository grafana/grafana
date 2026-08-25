package jobs

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/authlib/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// UserAttributionEnabledFunc reports whether user attribution is enabled for the
// request in ctx. It is injected so this package need not depend on the feature
// flag implementation, which lives in the main Grafana module.
type UserAttributionEnabledFunc func(ctx context.Context) bool

// AdmissionMutator attributes a Job to the acting user at creation time.
//
// It is the single entry point that enforces the user-attribution feature flag:
// the author annotations are only ever written here, from the request identity,
// and are cleared on every create so a client cannot spoof them. When
// attribution is disabled or the request is not made by a user (for example a
// background sync or webhook job run under the provisioning identity), the job
// keeps the default commit author.
type AdmissionMutator struct {
	userAttributionEnabled UserAttributionEnabledFunc
}

// NewAdmissionMutator creates a new job admission mutator. userAttributionEnabled
// gates whether the acting user is recorded on the job.
func NewAdmissionMutator(userAttributionEnabled UserAttributionEnabledFunc) *AdmissionMutator {
	return &AdmissionMutator{userAttributionEnabled: userAttributionEnabled}
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

	enabled := m.userAttributionEnabled != nil && m.userAttributionEnabled(ctx)

	requester, err := identity.GetRequester(ctx)
	isUser := err == nil && requester.IsIdentityType(types.TypeUser)

	if enabled && isUser {
		job.Annotations[AnnoAuthor] = requester.GetName()
		job.Annotations[AnnoAuthorEmail] = requester.GetEmail()
		job.Annotations[AnnoAuthorID] = requester.GetUID()
		job.Annotations[AnnoAuthorOrigin] = "Grafana"
		return nil
	}

	info, hasInfo := types.AuthInfoFrom(ctx)
	isProvisioningService := hasInfo && identity.IsProvisioningServiceIdentity(info)

	if enabled && isProvisioningService {
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
