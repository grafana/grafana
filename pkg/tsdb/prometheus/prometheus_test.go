package prometheus

import (
	"context"
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestExtendClientOpts(t *testing.T) {
	t.Run("add azure credentials if configured", func(t *testing.T) {
		cfg := backend.NewGrafanaCfg(map[string]string{
			azsettings.AzureCloud:       azsettings.AzurePublic,
			azsettings.AzureAuthEnabled: "true",
		})
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData: []byte(`{
				"azureCredentials": {
					"authType": "msi"
				}
			}`),
			DecryptedSecureJSONData: map[string]string{},
		}
		ctx := backend.WithGrafanaConfig(context.Background(), cfg)
		opts := &sdkhttpclient.Options{}
		err := extendClientOpts(ctx, settings, opts, log.NewNullLogger())
		require.NoError(t, err)
		require.Equal(t, 1, len(opts.Middlewares))
	})

	t.Run("add sigV4 auth if opts has SigV4 configured", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled:        false,
			BasicAuthUser:           "",
			JSONData:                []byte(""),
			DecryptedSecureJSONData: map[string]string{},
		}
		opts := &sdkhttpclient.Options{
			SigV4: &sdkhttpclient.SigV4Config{
				AuthType:  "test",
				AccessKey: "accesskey",
				SecretKey: "secretkey",
			},
		}
		err := extendClientOpts(context.Background(), settings, opts, log.NewNullLogger())
		require.NoError(t, err)
		require.Equal(t, "aps", opts.SigV4.Service)
	})
}

func TestShouldDisableQueryWarnings(t *testing.T) {
	t.Run("returns true when disableQueryWarnings is set", func(t *testing.T) {
		settings := &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"disableQueryWarnings": true}`),
		}
		require.True(t, shouldDisableQueryWarnings(settings))
	})

	t.Run("returns false when disableQueryWarnings is not set", func(t *testing.T) {
		settings := &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{}`),
		}
		require.False(t, shouldDisableQueryWarnings(settings))
	})

	t.Run("returns false when disableQueryWarnings is false", func(t *testing.T) {
		settings := &backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"disableQueryWarnings": false}`),
		}
		require.False(t, shouldDisableQueryWarnings(settings))
	})

	t.Run("returns false for nil settings", func(t *testing.T) {
		require.False(t, shouldDisableQueryWarnings(nil))
	})

	t.Run("returns false for invalid JSON", func(t *testing.T) {
		settings := &backend.DataSourceInstanceSettings{
			JSONData: []byte(`invalid`),
		}
		require.False(t, shouldDisableQueryWarnings(settings))
	})
}

func TestStripWarningNotices(t *testing.T) {
	t.Run("removes warning notices from frames", func(t *testing.T) {
		frame := data.NewFrame("test")
		frame.Meta = &data.FrameMeta{
			Notices: []data.Notice{
				{Severity: data.NoticeSeverityWarning, Text: "some warning"},
				{Severity: data.NoticeSeverityInfo, Text: "some info"},
				{Severity: data.NoticeSeverityWarning, Text: "another warning"},
			},
		}
		resp := &backend.QueryDataResponse{
			Responses: backend.Responses{
				"A": {Frames: data.Frames{frame}},
			},
		}

		stripWarningNotices(resp)

		require.Len(t, resp.Responses["A"].Frames[0].Meta.Notices, 1)
		require.Equal(t, data.NoticeSeverityInfo, resp.Responses["A"].Frames[0].Meta.Notices[0].Severity)
		require.Equal(t, "some info", resp.Responses["A"].Frames[0].Meta.Notices[0].Text)
	})

	t.Run("handles nil response", func(t *testing.T) {
		stripWarningNotices(nil) // should not panic
	})

	t.Run("handles frames without meta", func(t *testing.T) {
		frame := data.NewFrame("test")
		resp := &backend.QueryDataResponse{
			Responses: backend.Responses{
				"A": {Frames: data.Frames{frame}},
			},
		}

		stripWarningNotices(resp) // should not panic
	})

	t.Run("preserves non-warning notices", func(t *testing.T) {
		frame := data.NewFrame("test")
		frame.Meta = &data.FrameMeta{
			Notices: []data.Notice{
				{Severity: data.NoticeSeverityInfo, Text: "info notice"},
				{Severity: data.NoticeSeverityError, Text: "error notice"},
			},
		}
		resp := &backend.QueryDataResponse{
			Responses: backend.Responses{
				"A": {Frames: data.Frames{frame}},
			},
		}

		stripWarningNotices(resp)

		require.Len(t, resp.Responses["A"].Frames[0].Meta.Notices, 2)
	})
}
