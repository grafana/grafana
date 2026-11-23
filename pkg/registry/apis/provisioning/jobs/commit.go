package jobs

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"k8s.io/utils/ptr"
)

func CommitMessage(job provisioning.Job, defaultMessage string) string {
	if ptr.Deref(job.Spec.Message, "") != "" {
		return ptr.Deref(job.Spec.Message, "")
	}

	return defaultMessage
}
