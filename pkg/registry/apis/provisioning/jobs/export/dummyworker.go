package export

import (
	"context"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/util"
)

func dummyExport(
	ctx context.Context,
	repo repository.Repository,
	job provisioning.Job,
	progress jobs.ProgressFn,
) (*provisioning.JobStatus, error) {
	if repo.Config().Spec.ReadOnly {
		return &provisioning.JobStatus{
			State:  provisioning.JobStateError,
			Errors: []string{"Exporting to a read only repository is not supported"},
		}, nil
	}

	options := job.Spec.Export
	if options == nil {
		return &provisioning.JobStatus{
			State:  provisioning.JobStateError,
			Errors: []string{"Export job missing export settings"},
		}, nil
	}

	logger := logging.FromContext(ctx).With("logger", "exporter", "repository", repo.Config().Name, "namespace", repo.Config().Name)
	logger.Info("start export", "folder", options.Folder)

	size := 5 + rand.IntN(15)

	dashboards := provisioning.JobResourceSummary{
		Group:    "dashboard.grafana.app",
		Resource: "dashboards",
	}
	status := provisioning.JobStatus{
		State:    provisioning.JobStateWorking,
		Message:  "exporting..." + repo.Config().Spec.Title,
		Progress: 0,
	}

	if err := progress(ctx, status); err != nil {
		return nil, err
	}

	time.Sleep(200 * time.Millisecond)
	for i := 0; i < size; i++ {
		status.Progress = (float64(i) / float64(size)) * 100
		sleep := time.Duration(400+rand.IntN(800)) * time.Millisecond
		status.Message, _ = util.GetRandomString(rand.IntN(10 + 15))
		time.Sleep(sleep)

		for j := 0; j < (4 + rand.IntN(10)); j++ {
			switch rand.IntN(9) {
			case 0, 1, 2:
				dashboards.Create++
			case 3, 4:
				dashboards.Update++
			case 5:
				dashboards.Delete++
			case 6, 7, 8:
				dashboards.Noop++
			}
		}
		status.Summary = []provisioning.JobResourceSummary{
			dashboards,
		}

		if err := progress(ctx, status); err != nil {
			return nil, err
		}
	}

	status.State = provisioning.JobStateSuccess
	status.Message = fmt.Sprintf("pretended to export %d", size)
	status.Progress = 0

	logger.Info("finished export", "folder", options.Folder)
	return &status, nil
}
