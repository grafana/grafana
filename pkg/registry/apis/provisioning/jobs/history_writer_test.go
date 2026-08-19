package jobs

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestWriteJob_PreservesStatusAndLabels(t *testing.T) {
	fakeClient := newTestClientset()
	writer := NewAPIClientHistoryWriter(fakeClient)

	job := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:            "test-job",
			Namespace:       "stacks-123",
			UID:             "original-uid",
			ResourceVersion: "42",
		},
		Spec:   provisioning.JobSpec{Repository: "my-repo"},
		Status: provisioning.JobStatus{State: provisioning.JobStateSuccess, ProgressUpdates: 7},
	}

	require.NoError(t, writer.WriteJob(context.Background(), job))

	list, err := fakeClient.HistoricJobs("stacks-123").List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, list.Items, 1)

	historic := list.Items[0]
	assert.Equal(t, int64(7), historic.Status.ProgressUpdates,
		"historic job should preserve the number of progress updates the job went through")
	assert.Equal(t, provisioning.JobStateSuccess, historic.Status.State)
	assert.Empty(t, historic.ResourceVersion, "historic job gets its own resource version")
	assert.Equal(t, "my-repo", historic.Labels[LabelRepository])
	assert.Equal(t, "original-uid", historic.Labels[LabelJobOriginalUID])
}
