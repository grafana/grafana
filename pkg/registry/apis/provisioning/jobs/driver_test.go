package jobs

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func newConflictError() error {
	return apierrors.NewConflict(
		schema.GroupResource{Group: provisioning.GROUP, Resource: "jobs"},
		"test-job",
		nil,
	)
}

func makeTestJob(rv string) *provisioning.Job {
	return &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:            "test-job",
			Namespace:       "test-ns",
			ResourceVersion: rv,
		},
		Spec: provisioning.JobSpec{
			Repository: "test-repo",
			Action:     provisioning.JobActionPull,
		},
	}
}

// TestOnProgress_DeadlockOnConflict verifies that the onProgress callback
// does not deadlock when Store.Update returns a conflict error.
//
// Root cause: when Update returns a conflict, the retry loop calls `continue`
// without releasing d.mu. The next iteration calls d.mu.Lock() on the same
// goroutine — permanent deadlock since sync.Mutex is non-reentrant.
func TestOnProgress_DeadlockOnConflict(t *testing.T) {
	store := &MockStore{}
	driver := &jobDriver{store: store}
	driver.currentJob = makeTestJob("100")

	// First Update: conflict triggers retry
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once()
	// Retry fetches latest version
	freshJob := makeTestJob("200")
	store.EXPECT().Get(mock.Anything, "test-ns", "test-job").Return(freshJob, nil).Once()
	// Second Update: succeeds
	updatedJob := makeTestJob("201")
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(updatedJob, nil).Once()

	progressFn := driver.onProgress()
	status := provisioning.JobStatus{State: provisioning.JobStateWorking, Message: "test"}

	done := make(chan error, 1)
	go func() {
		done <- progressFn(context.Background(), status)
	}()

	select {
	case err := <-done:
		assert.NoError(t, err, "onProgress should succeed after conflict retry")
	case <-time.After(3 * time.Second):
		t.Fatal("DEADLOCK: onProgress hung — d.mu.Lock() called on goroutine that already holds it (missing Unlock before continue)")
	}
}

// TestOnProgress_AllRetriesConflict verifies that when ALL retries get
// conflicts, onProgress returns an error without deadlocking or leaking d.mu.
func TestOnProgress_AllRetriesConflict(t *testing.T) {
	store := &MockStore{}
	driver := &jobDriver{store: store}
	driver.currentJob = makeTestJob("100")

	// All attempts return conflict — the 3rd attempt has attempt < maxRetries-1 == false,
	// so it takes the non-conflict error path. But attempts 0 and 1 hit the `continue`.
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once() // attempt 0
	freshJob := makeTestJob("200")
	store.EXPECT().Get(mock.Anything, "test-ns", "test-job").Return(freshJob, nil).Once() // retry fetch for attempt 1
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once() // attempt 1
	freshJob2 := makeTestJob("300")
	store.EXPECT().Get(mock.Anything, "test-ns", "test-job").Return(freshJob2, nil).Once() // retry fetch for attempt 2
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once() // attempt 2 (last, no continue)

	progressFn := driver.onProgress()
	status := provisioning.JobStatus{State: provisioning.JobStateWorking, Message: "test"}

	done := make(chan error, 1)
	go func() {
		done <- progressFn(context.Background(), status)
	}()

	select {
	case err := <-done:
		assert.Error(t, err, "should return error after exhausting retries")
	case <-time.After(3 * time.Second):
		t.Fatal("DEADLOCK: onProgress hung during conflict retry exhaustion")
	}

	// Verify d.mu is NOT still held
	lockCh := make(chan struct{})
	go func() {
		driver.mu.Lock()
		close(lockCh)
		driver.mu.Unlock()
	}()
	select {
	case <-lockCh:
		// mutex is free
	case <-time.After(1 * time.Second):
		t.Fatal("d.mu is still held after onProgress returned — mutex leaked on conflict retry path")
	}
}

// TestOnProgress_MutexNotLeakedOnConflict verifies that after a conflict +
// successful retry, the mutex is properly released and other goroutines
// can acquire it (simulating the main driver thread).
func TestOnProgress_MutexNotLeakedOnConflict(t *testing.T) {
	store := &MockStore{}
	driver := &jobDriver{store: store}
	driver.currentJob = makeTestJob("100")

	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once()
	store.EXPECT().Get(mock.Anything, "test-ns", "test-job").Return(makeTestJob("200"), nil).Once()
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(makeTestJob("201"), nil).Once()

	progressFn := driver.onProgress()
	status := provisioning.JobStatus{State: provisioning.JobStateWorking, Message: "test"}

	done := make(chan error, 1)
	go func() {
		done <- progressFn(context.Background(), status)
	}()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("DEADLOCK in onProgress")
	}

	// Simulate what the main driver thread does after processJobWithLeaseCheck
	// returns (line 235 in driver.go). If the leaked goroutine held d.mu, this
	// would block forever.
	lockCh := make(chan struct{})
	go func() {
		driver.mu.Lock()
		close(lockCh)
		driver.mu.Unlock()
	}()
	select {
	case <-lockCh:
		// The main thread can acquire d.mu — no deadlock
	case <-time.After(1 * time.Second):
		t.Fatal("main thread cannot acquire d.mu — leaked goroutine from onProgress still holds the lock")
	}
}
