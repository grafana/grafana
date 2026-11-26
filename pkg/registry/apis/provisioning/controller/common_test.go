package controller

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

func expiredJob() *provisioning.Job {
	claimed := time.Now().Add(-time.Hour).UnixMilli()
	return &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "ns",
			Name:      "expired",
			UID:       "expired-uid",
			Labels:    map[string]string{jobs.LabelJobClaim: strconv.FormatInt(claimed, 10)},
		},
		Spec: provisioning.JobSpec{Action: provisioning.JobActionPull, Repository: "repo"},
	}
}

func historicJobCreates(client *fake.Clientset) int {
	var creates int
	for _, action := range client.Actions() {
		if action.Matches("create", "historicjobs") {
			creates++
		}
	}
	return creates
}

func TestProvideJobCleanup_ReapsExpiredJobs(t *testing.T) {
	t.Run("records reaped jobs through the provisioning API by default", func(t *testing.T) {
		client := fake.NewClientset(expiredJob())
		cleanup, err := ProvideJobCleanup(Common{Client: client, Registry: prometheus.NewPedanticRegistry()}, nil, jobs.ClaimExpiry)
		require.NoError(t, err)

		require.NoError(t, cleanup.Cleanup(context.Background()))

		_, err = client.ProvisioningV0alpha1().Jobs("ns").Get(context.Background(), "expired", metav1.GetOptions{})
		assert.True(t, apierrors.IsNotFound(err), "expected expired job to be removed, got %v", err)
		assert.Equal(t, 1, historicJobCreates(client))
	})

	t.Run("records reaped jobs through the given history writer", func(t *testing.T) {
		client := fake.NewClientset(expiredJob())
		writer := jobs.NewMockHistoryWriter(t)
		writer.On("WriteJob", mock.Anything, mock.MatchedBy(func(job *provisioning.Job) bool {
			return job.Name == "expired"
		})).Return(nil).Once()

		cleanup, err := ProvideJobCleanup(Common{Client: client, Registry: prometheus.NewPedanticRegistry()}, writer, jobs.ClaimExpiry)
		require.NoError(t, err)

		require.NoError(t, cleanup.Cleanup(context.Background()))

		assert.Zero(t, historicJobCreates(client))
	})
}
