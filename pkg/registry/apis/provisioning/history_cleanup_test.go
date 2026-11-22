package provisioning

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/apps/provisioning/pkg/loki"
)

func TestHistoryJobCleanupService_IsDisabled(t *testing.T) {
	tests := []struct {
		name     string
		builder  *APIBuilder
		disabled bool
	}{
		{name: "provisioning disabled", builder: nil, disabled: true},
		{name: "API server only", builder: &APIBuilder{onlyApiServer: true}, disabled: true},
		{name: "Loki history", builder: &APIBuilder{jobHistoryConfig: &JobHistoryConfig{Loki: &loki.Config{}}}, disabled: true},
		{name: "unified storage history", builder: &APIBuilder{jobHistoryConfig: &JobHistoryConfig{}}, disabled: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.disabled, ProvideHistoryJobCleanupService(tc.builder).IsDisabled())
		})
	}
}

func TestHistoryJobCleanupService_Run(t *testing.T) {
	t.Run("waits for the API server before cleaning up", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			const expiration = time.Hour
			client := fake.NewClientset(
				&provisioning.HistoricJob{ObjectMeta: metav1.ObjectMeta{
					Namespace:         "ns",
					Name:              "expired",
					CreationTimestamp: metav1.NewTime(time.Now().Add(-2 * expiration)),
				}},
			)
			builder := &APIBuilder{clientsetReady: make(chan struct{}), historyExpiration: expiration}

			ctx, cancel := context.WithCancel(context.Background())
			done := make(chan error)
			go func() { done <- ProvideHistoryJobCleanupService(builder).Run(ctx) }()

			synctest.Wait()
			_, err := client.ProvisioningV0alpha1().HistoricJobs("ns").Get(ctx, "expired", metav1.GetOptions{})
			require.NoError(t, err, "expected no cleanup before the API server is ready")

			builder.clientset = client
			close(builder.clientsetReady)
			synctest.Wait()
			_, err = client.ProvisioningV0alpha1().HistoricJobs("ns").Get(ctx, "expired", metav1.GetOptions{})
			assert.True(t, apierrors.IsNotFound(err), "expected expired job to be deleted, got %v", err)

			cancel()
			require.NoError(t, <-done)
		})
	})

	t.Run("returns when shut down before the API server is ready", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{clientsetReady: make(chan struct{})}
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			require.NoError(t, ProvideHistoryJobCleanupService(builder).Run(ctx))
		})
	})
}
