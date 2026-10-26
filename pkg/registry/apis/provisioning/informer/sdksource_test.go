package informer

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
)

var historicJobGVK = provisioningapis.HistoricJobResourceInfo.GroupVersionKind()

func runPeriodicSource(t *testing.T, list PeriodicListFunc) (*typeRecorder, cache.ResourceEventHandlerRegistration) {
	t.Helper()
	src, err := NewPeriodicDeltaSource(historicJobGVK, time.Hour, list)
	require.NoError(t, err)

	recorder := &typeRecorder{}
	registration, err := src.AddEventHandler(recorder)
	require.NoError(t, err)

	stop := make(chan struct{})
	t.Cleanup(func() { close(stop) })
	go src.Run(stop)

	return recorder, registration
}

// The controllers type-assert their own generated type off the delivered object, so the app-sdk wrapper the lister
// puts on has to come back off before delivery.
func TestPeriodicDeltaSourceDeliversTheGeneratedType(t *testing.T) {
	job := &provisioningapis.HistoricJob{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "old"}}
	recorder, _ := runPeriodicSource(t, func(context.Context) ([]runtime.Object, error) {
		return []runtime.Object{job}, nil
	})

	require.Eventually(t, func() bool { return recorder.last() != nil }, 5*time.Second, 5*time.Millisecond)

	delivered, ok := recorder.last().(*provisioningapis.HistoricJob)
	require.True(t, ok, "expected *HistoricJob, got %T", recorder.last())
	assert.Equal(t, job, delivered)
}

// A failed list must not report the source as synced, or the handler is released against nothing.
func TestPeriodicDeltaSourceRetriesTheInitialList(t *testing.T) {
	_, registration := runPeriodicSource(t, func(context.Context) ([]runtime.Object, error) {
		return nil, errors.New("api unavailable")
	})

	assert.Never(t, registration.HasSynced, 200*time.Millisecond, 20*time.Millisecond)
}

func TestPeriodicListerRejectsANonKubernetesObject(t *testing.T) {
	_, _, err := periodicLister{list: func(context.Context) ([]runtime.Object, error) {
		return []runtime.Object{&notAnObject{}}, nil
	}}.List(context.Background())

	assert.ErrorContains(t, err, "not a kubernetes object")
}

// notAnObject is a runtime.Object with no metadata accessors, which the app-sdk's wrapper cannot adapt.
type notAnObject struct{}

func (o *notAnObject) GetObjectKind() schema.ObjectKind { return schema.EmptyObjectKind }
func (o *notAnObject) DeepCopyObject() runtime.Object   { return &notAnObject{} }

// A live notification carries identity only, so the bus source builds the controller's own type from it. The job
// driver type-asserts *Job off the delivered object, so the app-sdk wrapper has to come back off here too.
func TestBusDeltaSourceDeliversTheGeneratedTypeFromALiveEvent(t *testing.T) {
	gvk := provisioningapis.JobResourceInfo.GroupVersionKind()
	subscriber := newFakeSubscriber()
	src, err := NewBusDeltaSource(subscriber, &provisioningapis.Job{}, gvk, time.Hour,
		func(context.Context) ([]runtime.Object, error) { return nil, nil }, nil)
	require.NoError(t, err)

	recorder := &typeRecorder{}
	_, err = src.AddEventHandler(recorder)
	require.NoError(t, err)

	stop := make(chan struct{})
	defer close(stop)
	go src.Run(stop)

	subject := resourcewatch.Subject(provisioningapis.JobResourceInfo.GroupVersionResource(), "")
	require.Eventually(t, func() bool { return subscriber.subscribed(subject) }, 5*time.Second, 5*time.Millisecond)

	subscriber.publish(t, subject, &resourcepb.WatchNotification{
		Type: resourcepb.WatchNotification_ADDED, Namespace: "ns", Name: "job-1", ResourceVersion: 7,
	})

	require.Eventually(t, func() bool { return recorder.last() != nil }, 5*time.Second, 5*time.Millisecond)
	delivered, ok := recorder.last().(*provisioningapis.Job)
	require.True(t, ok, "expected *Job, got %T", recorder.last())
	assert.Equal(t, "ns", delivered.Namespace)
	assert.Equal(t, "job-1", delivered.Name)
	assert.Equal(t, "7", delivered.ResourceVersion)
}

func TestBusDeltaSourceRequiresNats(t *testing.T) {
	_, err := NewBusDeltaSource(nil, &provisioningapis.Job{}, provisioningapis.JobResourceInfo.GroupVersionKind(),
		time.Hour, func(context.Context) ([]runtime.Object, error) { return nil, nil }, nil)
	assert.ErrorContains(t, err, "nats is not enabled")
}
