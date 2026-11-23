package controllerapp

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
)

func testHistoricJob(name string, age time.Duration) *apisprovisioning.HistoricJob {
	return &apisprovisioning.HistoricJob{ObjectMeta: metav1.ObjectMeta{
		Name:              name,
		Namespace:         "default",
		CreationTimestamp: metav1.NewTime(time.Now().Add(-age)),
	}}
}

func TestHistoricJobsDeletesOnlyExpiredJobs(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		clientset := fake.NewClientset(testHistoricJob("expired", 2*time.Hour), testHistoricJob("recent", time.Minute))
		app, err := New("test", logging.DefaultLogger, nil, HistoricJobs(clientset, false, time.Hour))
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- app.Run(ctx, time.Second, logging.DefaultLogger) }()
		synctest.Wait()

		remaining, err := clientset.ProvisioningV0alpha1().HistoricJobs("default").List(t.Context(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, remaining.Items, 1)
		assert.Equal(t, "recent", remaining.Items[0].Name)

		cancel()
		require.NoError(t, <-done)
	})
}

func TestLogErrorsKeepsOtherRunnablesRunning(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		app, err := New("test", logging.DefaultLogger, nil)
		require.NoError(t, err)
		app.AddRunnable(LogErrors(logging.DefaultLogger, "failing loop", func(context.Context) error {
			return errors.New("boom")
		}))
		stopped := make(chan struct{})
		app.AddRunnable(RunnableFunc(func(ctx context.Context) error {
			<-ctx.Done()
			close(stopped)
			return nil
		}))

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan error, 1)
		go func() { done <- app.Run(ctx, time.Second, logging.DefaultLogger) }()
		synctest.Wait()

		select {
		case <-stopped:
			t.Fatal("a failed LogErrors runnable stopped the app's other runnables")
		default:
		}

		cancel()
		require.NoError(t, <-done)
		<-stopped
	})
}
