package jobs

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// HistoryReader keeps track of completed jobs
//
//go:generate mockery --name HistoryReader --structname MockHistoryReader --inpackage --filename history_reader_mock.go --with-expecter
type HistoryReader interface {
	// Gets recent jobs for a repository
	RecentJobs(ctx context.Context, namespace, repo string) (*provisioning.JobList, error)

	// find a specific job from the original UID
	GetJob(ctx context.Context, namespace, repo, uid string) (*provisioning.Job, error)
}

// NewStorageBackedHistory creates a History client backed by unified storage
// This should be replaced by loki when running in cloud
func NewStorageBackedHistory(store rest.Storage) (HistoryReader, error) {
	var ok bool
	history := &storageBackedHistory{}
	history.lister, ok = store.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("storage does not implement rest.Lister")
	}

	return history, nil
}

type storageBackedHistory struct {
	lister rest.Lister
}

func (s *storageBackedHistory) getJobs(ctx context.Context, namespace string, labels labels.Set) (*provisioning.JobList, error) {
	ctx = request.WithNamespace(ctx, namespace)
	obj, err := s.lister.List(ctx, &internalversion.ListOptions{
		LabelSelector: labels.AsSelector(),
	})
	if err != nil {
		return nil, err
	}

	historic, ok := obj.(*provisioning.HistoricJobList)
	if !ok {
		return nil, fmt.Errorf("expected HistoricJobList, found %T", historic)
	}

	jobs := &provisioning.JobList{
		ListMeta: historic.ListMeta,
	}
	for _, job := range historic.Items {
		jobs.Items = append(jobs.Items, provisioning.Job{
			ObjectMeta: job.ObjectMeta,
			Spec:       job.Spec,
			Status:     job.Status,
		})
	}
	return jobs, nil
}

// Recent implements History.
func (s *storageBackedHistory) RecentJobs(ctx context.Context, namespace, repo string) (*provisioning.JobList, error) {
	return s.getJobs(ctx, namespace, labels.Set{
		LabelRepository: repo,
	})
}

// GetJob implements History.
func (s *storageBackedHistory) GetJob(ctx context.Context, namespace, repo, job string) (*provisioning.Job, error) {
	jobs, err := s.getJobs(ctx, namespace, labels.Set{
		LabelJobOriginalUID: job,
	})
	if err != nil {
		return nil, err
	}
	if len(jobs.Items) == 1 {
		return &jobs.Items[0], nil
	}
	return nil, apierrors.NewNotFound(provisioning.JobResourceInfo.GroupResource(), job)
}
