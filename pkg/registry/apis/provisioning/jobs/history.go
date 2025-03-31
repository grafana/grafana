package jobs

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type History interface {
	// Adds a job to the history
	Write(ctx context.Context, job *provisioning.Job) error

	// Gets recent jobs for a repository
	Recent(ctx context.Context, repo string) (*provisioning.JobList, error)
}

func NewStorageBackedHistory(store rest.Storage) (History, error) {
	var ok bool
	history := &storageBackedHistory{}
	history.creator, ok = store.(rest.Creater)
	if !ok {
		return nil, fmt.Errorf("storage does not implement rest.Creater")
	}

	history.lister, ok = store.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("storage does not implement rest.Lister")
	}

	return history, nil
}

type storageBackedHistory struct {
	creator rest.Creater
	lister  rest.Lister
}

// Write implements History.
func (s *storageBackedHistory) Write(ctx context.Context, job *provisioning.Job) error {
	_, err := s.creator.Create(ctx, &provisioning.HistoricJob{
		ObjectMeta: job.ObjectMeta,
		Spec:       job.Spec,
		Status:     job.Status,
	}, nil, &metav1.CreateOptions{})
	return err
}

// Recent implements History.
func (s *storageBackedHistory) Recent(ctx context.Context, repo string) (*provisioning.JobList, error) {
	labels := labels.Set{
		LabelRepository: repo,
	}
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
