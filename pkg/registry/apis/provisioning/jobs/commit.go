package jobs

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func CommitMessage(job provisioning.Job, defaultMessage string) string {
	if job.Spec.Message != "" {
		return job.Spec.Message
	}

	return defaultMessage
}
