package informer

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/controllerapp"
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
		app, err := controllerapp.New("test", logging.DefaultLogger, nil, HistoricJobsKind(clientset, false, time.Hour))
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
