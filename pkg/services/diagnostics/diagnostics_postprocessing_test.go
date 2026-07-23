package diagnostics

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

func TestBundler_Build_recordsFrontendProcessing(t *testing.T) {
	pp := json.RawMessage(`{"transformations":[{"id":"reduce","options":{}}],` +
		`"input":[{"schema":{"name":"in"}}],"output":[{"schema":{"name":"out"}}],` +
		`"display":{"pluginId":"timeseries"}}`)

	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, nil, nil, nil, pp, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "frontend-processing.json")
	body := string(files["frontend-processing.json"])
	require.Contains(t, body, `"transformations"`)
	require.Contains(t, body, `"reduce"`)
	require.Contains(t, body, `"input"`)
	require.Contains(t, body, `"output"`)
	require.Contains(t, body, `"timeseries"`)
}

func TestBundler_Build_omitsEmptyFrontendProcessing(t *testing.T) {
	for _, raw := range []json.RawMessage{nil, json.RawMessage(""), json.RawMessage("  "), json.RawMessage("null")} {
		blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, json.RawMessage(`{"id":1}`), nil, nil, raw, nil, nil)
		require.NoError(t, err)
		files := readTarGz(t, blob)
		require.NotContains(t, files, "frontend-processing.json",
			"no artifact when the client sent no post-processing evidence (%q)", string(raw))
	}
}

func TestMarshalPostProcessingArtifact_truncatesOverBudget(t *testing.T) {
	big := make([]byte, 0, 4096)
	big = append(big, []byte(`{"output":[{"schema":{"name":"`)...)
	big = append(big, []byte(strings.Repeat("x", 2000))...)
	big = append(big, []byte(`"}}]}`)...)

	out := marshalPostProcessingArtifact(json.RawMessage(big), 512)
	require.NotEmpty(t, out)

	var marker struct {
		Truncated     bool `json:"truncated"`
		OriginalBytes int  `json:"originalBytes"`
		LimitBytes    int  `json:"limitBytes"`
	}
	require.NoError(t, json.Unmarshal(out, &marker))
	require.True(t, marker.Truncated)
	require.Equal(t, 512, marker.LimitBytes)
	require.Greater(t, marker.OriginalBytes, 512)
	require.NotContains(t, string(out), strings.Repeat("x", 100), "the oversized payload itself is not embedded")
}
