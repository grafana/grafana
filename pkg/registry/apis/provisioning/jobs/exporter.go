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

type Exporter interface {
	// Long running process that will export values into the target repository
	Export(ctx context.Context,
		repo repository.Repository,
		options provisioning.ExportOptions,
		cb func(*provisioning.WorkerProgressMessage),
	) (*provisioning.WorkerProgressMessage, error)
}

// Dummy for now...
func NewExporter() Exporter {
	return &dummyExporter{}
}

type dummyExporter struct{}

func (s *dummyExporter) Export(ctx context.Context,
	repo repository.Repository,
	options provisioning.ExportOptions,
	cb func(*provisioning.WorkerProgressMessage),
) (*provisioning.WorkerProgressMessage, error) {
	logger := logging.FromContext(ctx).With("logger", "exporter", "repository", repo.Config().Name, "namespace", repo.Config().Name)
	logger.Info("start export", "folder", options.Folder)

	msg := &provisioning.WorkerProgressMessage{
		State: provisioning.JobStatePending,
		Index: 0,
		Size:  10 + rand.Int64N(100),
	}

	msg.Message = "exporting... " + repo.Config().Spec.Title
	cb(msg)
	time.Sleep(200 * time.Millisecond)
	msg.State = provisioning.JobStateWorking
	for i := msg.Index; i < msg.Size; i++ {
		msg.Index = i
		name, err := util.GetRandomString(rand.IntN(20 + 4))
		if err != nil {
			return nil, err
		}

		sleep := time.Duration(50+rand.IntN(200)) * time.Millisecond
		msg.Message = fmt.Sprintf("processing %s (%s)", name, sleep)
		time.Sleep(sleep)
		cb(msg)
	}

	msg.State = provisioning.JobStateSuccess
	msg.Message = "exported xyz"
	msg.Index = 0
	msg.Size = 0
	msg.URL = "https://github.com/grafana/git-ui-sync-demo/tree/ryan-test"

	logger.Info("finished export", "folder", options.Folder)
	return msg, nil
}
