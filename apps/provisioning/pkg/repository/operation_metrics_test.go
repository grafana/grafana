package repository

import (
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// The sync.Once singleton can only bind to one registry per test binary, so all
// tests here observe the same one.
var testOperationMetrics = RegisterOperationMetrics(testRegistry)

func TestRegisterOperationMetrics(t *testing.T) {
	t.Run("returns same instance on repeated calls", func(t *testing.T) {
		assert.Same(t, RegisterOperationMetrics(testRegistry), RegisterOperationMetrics(testRegistry))
	})

	t.Run("double registration is safe with sync.Once", func(t *testing.T) {
		require.NotPanics(t, func() {
			RegisterOperationMetrics(prometheus.NewPedanticRegistry())
		})
	})
}

func TestOperationMetrics_NilSafety(t *testing.T) {
	var metrics *OperationMetrics
	recorder := metrics.Recorder(provisioning.GitRepositoryType)
	require.Nil(t, recorder, "no metrics means no recorder")

	// A repository built without metrics still records through the nil recorder.
	require.NotPanics(t, func() {
		recorder.Read(time.Now(), &FileInfo{Data: []byte("x")}, nil)
		recorder.Write(time.Now(), 1, nil)
		recorder.List(time.Now(), nil)
		recorder.Delete(time.Now(), nil)
		recorder.Move(time.Now(), errors.New("boom"))
		recorder.Push(time.Now(), nil)
	})
}

func TestOperationRecorder(t *testing.T) {
	recorder := testOperationMetrics.Recorder(provisioning.RepositoryType("recorder_test"))
	require.NotNil(t, recorder)

	t.Run("read records size, duration and outcome", func(t *testing.T) {
		recorder.Read(time.Now(), &FileInfo{Data: []byte("123456")}, nil)

		assert.Equal(t, 1.0, operationCount(t, OperationRead, "recorder_test", "success"))
		assert.Equal(t, uint64(1), sizeSamples(t, OperationRead, "recorder_test"))
		assert.Equal(t, 6.0, sizeSum(t, OperationRead, "recorder_test"))
		assert.Equal(t, uint64(1), durationSamples(t, OperationRead, "recorder_test"))
	})

	t.Run("read of a nil FileInfo is a zero-byte read", func(t *testing.T) {
		recorder.Read(time.Now(), nil, nil)

		assert.Equal(t, 2.0, operationCount(t, OperationRead, "recorder_test", "success"))
		assert.Equal(t, 6.0, sizeSum(t, OperationRead, "recorder_test"), "no bytes added")
	})

	t.Run("failed read records the outcome but not a size", func(t *testing.T) {
		recorder.Read(time.Now(), nil, errors.New("boom"))

		assert.Equal(t, 1.0, operationCount(t, OperationRead, "recorder_test", "error"))
		assert.Equal(t, uint64(2), sizeSamples(t, OperationRead, "recorder_test"), "unchanged by the failure")
	})

	t.Run("write records the payload size", func(t *testing.T) {
		recorder.Write(time.Now(), 128, nil)

		assert.Equal(t, 1.0, operationCount(t, OperationWrite, "recorder_test", "success"))
		assert.Equal(t, 128.0, sizeSum(t, OperationWrite, "recorder_test"))
	})

	t.Run("failed write records the outcome but not a size", func(t *testing.T) {
		recorder.Write(time.Now(), 128, errors.New("boom"))

		assert.Equal(t, 1.0, operationCount(t, OperationWrite, "recorder_test", "error"))
		assert.Equal(t, uint64(1), sizeSamples(t, OperationWrite, "recorder_test"))
	})

	t.Run("operations without a payload record duration and outcome only", func(t *testing.T) {
		recorder.List(time.Now(), nil)
		recorder.Delete(time.Now(), nil)
		recorder.Move(time.Now(), errors.New("boom"))

		for _, op := range []string{OperationList, OperationDelete, OperationMove} {
			assert.Equal(t, uint64(1), durationSamples(t, op, "recorder_test"), op)
			assert.Zero(t, sizeSamples(t, op, "recorder_test"), "%s carries no byte payload", op)
		}
		assert.Equal(t, 1.0, operationCount(t, OperationList, "recorder_test", "success"))
		assert.Equal(t, 1.0, operationCount(t, OperationDelete, "recorder_test", "success"))
		assert.Equal(t, 1.0, operationCount(t, OperationMove, "recorder_test", "error"))
	})

	t.Run("push records duration and outcome", func(t *testing.T) {
		recorder.Push(time.Now(), nil)
		recorder.Push(time.Now(), errors.New("boom"))

		assert.Equal(t, 1.0, operationCount(t, OperationPush, "recorder_test", "success"))
		assert.Equal(t, 1.0, operationCount(t, OperationPush, "recorder_test", "error"))
		assert.Equal(t, uint64(2), durationSamples(t, OperationPush, "recorder_test"))
		assert.Zero(t, sizeSamples(t, OperationPush, "recorder_test"), "push carries no byte payload")
	})

	t.Run("recorders label by repository type", func(t *testing.T) {
		other := testOperationMetrics.Recorder(provisioning.RepositoryType("other_test"))
		other.Delete(time.Now(), nil)

		assert.Equal(t, 1.0, operationCount(t, OperationDelete, "other_test", "success"))
		assert.Equal(t, 1.0, operationCount(t, OperationDelete, "recorder_test", "success"), "unaffected")
	})
}

func operationCount(t *testing.T, operation, repoType, outcome string) float64 {
	t.Helper()
	m := findMetric(t, "grafana_provisioning_repository_operations_total", map[string]string{
		"operation": operation, "repository_type": repoType, "outcome": outcome,
	})
	if m == nil {
		return 0
	}
	return m.GetCounter().GetValue()
}

func sizeSamples(t *testing.T, operation, repoType string) uint64 {
	t.Helper()
	return histogram(t, "grafana_provisioning_repository_operation_size_bytes", operation, repoType).GetSampleCount()
}

func sizeSum(t *testing.T, operation, repoType string) float64 {
	t.Helper()
	return histogram(t, "grafana_provisioning_repository_operation_size_bytes", operation, repoType).GetSampleSum()
}

func durationSamples(t *testing.T, operation, repoType string) uint64 {
	t.Helper()
	return histogram(t, "grafana_provisioning_repository_operation_duration_seconds", operation, repoType).GetSampleCount()
}

func histogram(t *testing.T, name, operation, repoType string) *dto.Histogram {
	t.Helper()
	m := findMetric(t, name, map[string]string{"operation": operation, "repository_type": repoType})
	if m == nil {
		return &dto.Histogram{}
	}
	return m.GetHistogram()
}

// findMetric returns the sample of family whose labels match want, or nil when
// the series has not been observed yet.
func findMetric(t *testing.T, family string, want map[string]string) *dto.Metric {
	t.Helper()
	families, err := testRegistry.Gather()
	require.NoError(t, err)

	for _, f := range families {
		if f.GetName() != family {
			continue
		}
		for _, m := range f.GetMetric() {
			matches := true
			for _, l := range m.GetLabel() {
				if v, ok := want[l.GetName()]; ok && v != l.GetValue() {
					matches = false
					break
				}
			}
			if matches {
				return m
			}
		}
	}
	return nil
}
