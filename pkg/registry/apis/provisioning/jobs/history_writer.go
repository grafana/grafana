package jobs

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
)

// HistoryWriter stores completed jobs
//
//go:generate mockery --name=HistoryWriter --structname=MockHistoryWriter --inpackage --filename history_writer_mock.go --with-expecter
type HistoryWriter interface {
	// Adds a job to the history
	WriteJob(ctx context.Context, job *provisioning.Job) error
}

type apiClientHistoryWriter struct {
	client client.ProvisioningV0alpha1Interface
}

// NewAPIClientHistoryWriter creates a HistoryWriter backed by the provisioning API client.
func NewAPIClientHistoryWriter(provisioningClient client.ProvisioningV0alpha1Interface) HistoryWriter {
	return &apiClientHistoryWriter{
		client: provisioningClient,
	}
}

// WriteJob implements HistoryWriter.
func (w *apiClientHistoryWriter) WriteJob(ctx context.Context, job *provisioning.Job) error {
	if job.UID == "" {
		return fmt.Errorf("missing UID in job '%s'", job.GetName())
	}

	// Create a copy of the job's metadata to avoid modifying the original
	meta := job.ObjectMeta.DeepCopy()

	// Ensure labels map exists
	if meta.Labels == nil {
		meta.Labels = make(map[string]string)
	}

	// Add required labels for history tracking
	meta.Labels[LabelRepository] = job.Spec.Repository
	meta.Labels[LabelJobOriginalUID] = string(job.UID)

	// Generate a new name based on the input job
	meta.GenerateName = job.Name + "-"
	meta.Name = ""
	// We also reset the UID as this is not the same object.
	meta.UID = ""
	// We aren't allowed to write with ResourceVersion set.
	meta.ResourceVersion = ""

	// Create the historic job using the API client
	historicJob := &provisioning.HistoricJob{
		ObjectMeta: *meta,
		Spec:       job.Spec,
		Status:     job.Status,
	}

	_, err := w.client.HistoricJobs(job.Namespace).Create(ctx, historicJob, metav1.CreateOptions{})

	return err
}
