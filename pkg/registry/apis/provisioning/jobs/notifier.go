package jobs

import (
	"context"
	"time"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

// MaybeNotifyProgress will only notify if a certain amount of time has passed
// or if the job completed
func MaybeNotifyProgress(threshold time.Duration, fn ProgressFn) ProgressFn {
	var last time.Time

	return func(ctx context.Context, status provisioning.JobStatus) error {
		if status.Finished != 0 || last.IsZero() || time.Since(last) > threshold {
			last = time.Now()
			return fn(ctx, status)
		}

		return nil
	}
}
