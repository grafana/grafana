package jobs

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/util/ptr"
)

func CommitMessage(job provisioning.Job, defaultMessage string) string {
	if ptr.Deref(job.Spec.Message) != "" {
		return ptr.Deref(job.Spec.Message)
	}

	return defaultMessage
}
