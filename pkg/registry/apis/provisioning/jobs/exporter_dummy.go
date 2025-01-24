package jobs

import (
	"context"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/util"
)

type dummyExporter struct{}

func (s *dummyExporter) Export(ctx context.Context,
	repo repository.Repository,
	options provisioning.ExportOptions,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, error) {
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

	err := progress(status)
	if err != nil {
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

		err = progress(status)
		if err != nil {
			return nil, err
		}
	}

	status.State = provisioning.JobStateSuccess
	status.Message = fmt.Sprintf("pretended to export %d", size)
	status.Progress = 0

	logger.Info("finished export", "folder", options.Folder)
	return &status, nil
}
