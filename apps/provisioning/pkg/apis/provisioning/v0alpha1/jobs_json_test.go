package v0alpha1_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// The fixtures hold the wire format of the value-typed Job structs. Reshaping the structs
// (for example into the pointers App SDK codegen emits) must keep them round-tripping
// byte for byte.
func TestJobJSONRoundTrip(t *testing.T) {
	for _, tc := range []struct {
		file string
		obj  any
	}{
		{file: "job-full.json", obj: &v0alpha1.Job{}},
		{file: "job-minimal.json", obj: &v0alpha1.HistoricJob{}},
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
