package jobs

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// HistoryWriter stores completed jobs
//
//go:generate mockery --name History --structname MockHistoryWriter --inpackage --filename history_writer_mock.go --with-expecter
type HistoryWriter interface {
	// Adds a job to the history
	WriteJob(ctx context.Context, job *provisioning.Job) error
}

// TODO: we should store using APIs instead
// NewStorageBackedHistoryWriter creates a HistoryWriter backed by unified storage.
// This implementation should be replaced by Loki when running in a cloud environment.
func NewStorageBackedHistoryWriter(store rest.Storage) (HistoryWriter, error) {
	var ok bool
	history := &storageBackedHistoryWriter{}
	history.creator, ok = store.(rest.Creater)
	if !ok {
		return nil, fmt.Errorf("storage does not implement rest.Creater")
	}

	return history, nil
}

type storageBackedHistoryWriter struct {
	creator rest.Creater
}

// Write implements History.
func (s *storageBackedHistoryWriter) WriteJob(ctx context.Context, job *provisioning.Job) error {
	if job.UID == "" {
		return fmt.Errorf("missing UID in job '%s'", job.GetName())
	}
	if job.Labels == nil {
		job.Labels = make(map[string]string)
	}
	job.Labels[LabelRepository] = job.Spec.Repository
	job.Labels[LabelJobOriginalUID] = string(job.UID)

	// Generate a new name based on the input job
	job.GenerateName = job.Name + "-"
	job.Name = ""
	// We also reset the UID as this is not the same object.
	job.UID = ""
	// We aren't allowed to write with ResourceVersion set.
	job.ResourceVersion = ""

	_, err := s.creator.Create(ctx, &provisioning.HistoricJob{
		ObjectMeta: job.ObjectMeta,
		Spec:       job.Spec,
		Status:     job.Status,
	}, nil, &metav1.CreateOptions{})

	return err
}
