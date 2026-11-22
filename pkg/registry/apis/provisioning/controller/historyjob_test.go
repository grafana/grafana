package controller

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
)

func TestProvideHistoryJobCleanup_DeletesOnlyExpiredJobs(t *testing.T) {
	historicJob := func(name string, age time.Duration) *provisioning.HistoricJob {
		return &provisioning.HistoricJob{ObjectMeta: metav1.ObjectMeta{
			Namespace:         "ns",
			Name:              name,
			CreationTimestamp: metav1.NewTime(time.Now().Add(-age)),
		}}
	}

	for _, tc := range []struct {
		name        string
		natsEnabled bool
	}{
		{name: "NATS off uses apiserver informer", natsEnabled: false},
		{name: "NATS on uses periodic lister", natsEnabled: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				const expiration = time.Hour
				client := fake.NewClientset(
					historicJob("expired", 2*expiration),
					historicJob("fresh", expiration/2),
				)

				source, err := ProvideHistoryJobCleanup(tc.natsEnabled, client, expiration)
				require.NoError(t, err)

				stop := make(chan struct{})
				defer close(stop)
				go source.Run(stop)

				synctest.Wait()

				jobs := client.ProvisioningV0alpha1().HistoricJobs("ns")
				_, err = jobs.Get(context.Background(), "expired", metav1.GetOptions{})
				assert.True(t, apierrors.IsNotFound(err), "expected expired job to be deleted, got %v", err)
				_, err = jobs.Get(context.Background(), "fresh", metav1.GetOptions{})
				assert.NoError(t, err, "expected fresh job to be kept")
			})
		})
	}
}
