package v0alpha1_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// The fixtures hold the wire format of the hand-written structs the generated ones
// replaced. The pointers App SDK codegen emits must keep them round-tripping byte for byte.
func TestJSONRoundTrip(t *testing.T) {
	for _, tc := range []struct {
		file string
		obj  any
	}{
		{file: "job-full.json", obj: &v0alpha1.Job{}},
		{file: "job-minimal.json", obj: &v0alpha1.HistoricJob{}},
		{file: "connection-full.json", obj: &v0alpha1.Connection{}},
		{file: "connection-minimal.json", obj: &v0alpha1.Connection{}},
	} {
		t.Run(tc.file, func(t *testing.T) {
			want, err := os.ReadFile(filepath.Join("testdata", tc.file))
			require.NoError(t, err)

			require.NoError(t, json.Unmarshal(want, tc.obj))
			got, err := json.MarshalIndent(tc.obj, "", "  ")
			require.NoError(t, err)
			require.Equal(t, string(want), string(got)+"\n")
		})
	}
}

func TestUnsetTestJobDurationEncodesZero(t *testing.T) {
	for _, obj := range []any{v0alpha1.JobTestJobOptions{}, v0alpha1.HistoricJobTestJobOptions{}} {
		got, err := json.Marshal(obj)
		require.NoError(t, err)
		require.JSONEq(t, `{"duration":"0s"}`, string(got))
	}
}

func TestJobHistoricConversionRoundTrip(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("testdata", "job-full.json"))
	require.NoError(t, err)
	var job v0alpha1.Job
	require.NoError(t, json.Unmarshal(raw, &job))

	historicSpec, err := job.Spec.ToHistoric()
	require.NoError(t, err)
	historicStatus, err := job.Status.ToHistoric()
	require.NoError(t, err)

	spec, err := historicSpec.ToJob()
	require.NoError(t, err)
	status, err := historicStatus.ToJob()
	require.NoError(t, err)
	require.Equal(t, job.Spec, spec)
	require.Equal(t, job.Status, status)
}
