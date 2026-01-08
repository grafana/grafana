package lokiconfig

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestLokiConfig(t *testing.T) {
	t.Run("test URL options", func(t *testing.T) {
		type testCase struct {
			name     string
			in       setting.UnifiedAlertingLokiSettings
			expRead  string
			expWrite string
			expErr   string
		}

		cases := []testCase{
			{
				name: "remote url only",
				in: setting.UnifiedAlertingLokiSettings{
					LokiRemoteURL: "http://url.com",
				},
				expRead:  "http://url.com",
				expWrite: "http://url.com",
			},
			{
				name: "separate urls",
				in: setting.UnifiedAlertingLokiSettings{
					LokiReadURL:  "http://read.url.com",
					LokiWriteURL: "http://write.url.com",
				},
				expRead:  "http://read.url.com",
				expWrite: "http://write.url.com",
			},
			{
				name: "single fallback",
				in: setting.UnifiedAlertingLokiSettings{
					LokiRemoteURL: "http://url.com",
					LokiReadURL:   "http://read.url.com",
				},
				expRead:  "http://read.url.com",
				expWrite: "http://url.com",
			},
			{
				name: "missing read",
				in: setting.UnifiedAlertingLokiSettings{
					LokiWriteURL: "http://url.com",
				},
				expErr: "either read path URL or remote",
			},
			{
				name: "missing write",
				in: setting.UnifiedAlertingLokiSettings{
					LokiReadURL: "http://url.com",
				},
				expErr: "either write path URL or remote",
			},
			{
				name: "invalid",
				in: setting.UnifiedAlertingLokiSettings{
					LokiRemoteURL: "://://",
				},
				expErr: "failed to parse",
			},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				res, err := NewLokiConfig(tc.in)
				if tc.expErr != "" {
					require.ErrorContains(t, err, tc.expErr)
				} else {
					require.Equal(t, tc.expRead, res.ReadPathURL.String())
					require.Equal(t, tc.expWrite, res.WritePathURL.String())
				}
			})
		}
	})

	t.Run("captures external labels", func(t *testing.T) {
		set := setting.UnifiedAlertingLokiSettings{
			LokiRemoteURL:  "http://url.com",
			ExternalLabels: map[string]string{"a": "b"},
		}

		res, err := NewLokiConfig(set)

		require.NoError(t, err)
		require.Contains(t, res.ExternalLabels, "a")
	})
}
