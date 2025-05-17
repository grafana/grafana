package jobs

import (
	"context"
	"fmt"
	"sync"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

// History keeps track of completed jobs
//
//go:generate mockery --name History --structname MockHistory --inpackage --filename history_mock.go --with-expecter
type History interface {
	// Adds a job to the history
	WriteJob(ctx context.Context, job *provisioning.Job) error

	// Gets recent jobs for a repository
	RecentJobs(ctx context.Context, namespace, repo string) (*provisioning.JobList, error)

	// find a specific job from the original UID
	GetJob(ctx context.Context, namespace, repo, uid string) (*provisioning.Job, error)
}

// NewJobHistoryCache creates a History client
func NewJobHistoryCache() History {
	history := &recentHistory{
		maxJobs:     9, // 10-1
		repoHistory: make(map[string]provisioning.JobList),
	}
	return history
}

type recentHistory struct {
	maxJobs     int
	repoMu      sync.Mutex
	repoHistory map[string]provisioning.JobList
}

// Write implements History.
func (h *recentHistory) WriteJob(ctx context.Context, job *provisioning.Job) error {
	h.repoMu.Lock()
	defer h.repoMu.Unlock()

	copy := job.DeepCopy()
	delete(copy.Labels, LabelJobClaim)

	items := []provisioning.Job{*copy}
	key := fmt.Sprintf("%s/%s", job.Namespace, job.Spec.Repository)
	v, ok := h.repoHistory[key]
	if ok {
		max := min(len(v.Items), h.maxJobs)
		items = append(items, v.Items[0:max]...)
	}
	h.repoHistory[key] = provisioning.JobList{Items: items}
	return nil
}

// Recent implements History.
func (h *recentHistory) RecentJobs(ctx context.Context, namespace, repo string) (*provisioning.JobList, error) {
	h.repoMu.Lock()
	defer h.repoMu.Unlock()

	rsp := &provisioning.JobList{}
	key := fmt.Sprintf("%s/%s", namespace, repo)
	v, ok := h.repoHistory[key]
	if ok {
		rsp.Items = v.Items
	}
	return rsp, nil
}

func (h *recentHistory) GetJob(ctx context.Context, namespace, repo, job string) (*provisioning.Job, error) {
	jobs, err := h.RecentJobs(ctx, namespace, repo)
	if err != nil {
		return nil, err
	}
	for _, item := range jobs.Items {
		if string(item.UID) == job {
			return &item, nil
		}
	}
	return nil, apierrors.NewNotFound(provisioning.JobResourceInfo.GroupResource(), job)
}
