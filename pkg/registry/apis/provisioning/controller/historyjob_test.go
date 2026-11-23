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
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/services/apiserver/informers"
	"github.com/grafana/grafana/pkg/services/apiserver/informers/informerstest"
	"github.com/grafana/grafana/pkg/setting"
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
		{name: "NATS off watches the API", natsEnabled: false},
		{name: "NATS on re-lists", natsEnabled: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				const expiration = time.Hour
				jobs := []runtime.Object{historicJob("expired", 2*expiration), historicJob("fresh", expiration/2)}
				// The informer reads through the SDK clients, the controller deletes through the clientset.
				client := fake.NewClientset(jobs...)

				cfg := &setting.Cfg{NATS: setting.NATSSettings{Enabled: tc.natsEnabled}}
				source, err := ProvideHistoryJobCleanup(context.Background(), informers.ProvideSupplier(cfg, nil), informerstest.NewClients(jobs...), client, expiration)
				require.NoError(t, err)

				stop := make(chan struct{})
				defer close(stop)
				go source.Run(stop)

				synctest.Wait()

				stored := client.ProvisioningV0alpha1().HistoricJobs("ns")
				_, err = stored.Get(context.Background(), "expired", metav1.GetOptions{})
				assert.True(t, apierrors.IsNotFound(err), "expected expired job to be deleted, got %v", err)
				_, err = stored.Get(context.Background(), "fresh", metav1.GetOptions{})
				assert.NoError(t, err, "expected fresh job to be kept")
			})
		})
	}
}
