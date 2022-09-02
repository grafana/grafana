package plugins

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/manifest"
	"github.com/grafana/grafana/pkg/plugins/signature"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCalculateSignature(t *testing.T) {
	t.Run("Validate root URL against App URL for non-private plugin if is specified in manifest", func(t *testing.T) {
		tcs := []struct {
			appURL            string
			expectedSignature Signature
		}{
			{
				appURL: "https://dev.grafana.com",
				expectedSignature: Signature{
					Status:     signature.Valid,
					Type:       manifest.GrafanaSignatureType,
					SigningOrg: "Grafana Labs",
				},
			},
			{
				appURL: "https://non.matching.url.com",
				expectedSignature: Signature{
					Status: signature.Invalid,
				},
			},
		}

		parentDir, err := filepath.Abs("../")
		if err != nil {
			t.Errorf("could not construct absolute path of current dir")
			return
		}

		for _, tc := range tcs {
			origAppURL := setting.AppUrl
			t.Cleanup(func() {
				setting.AppUrl = origAppURL
			})
			setting.AppUrl = tc.appURL

			p := &Plugin{
				JSONData: JSONData{
					ID: "test-datasource",
					Info: Info{
						Version: "1.0.0",
					},
				},
				PluginDir: filepath.Join(parentDir, "testdata/non-pvt-with-root-url/plugin"),
				Class:     External,
			}

			err := p.CalculateSignature()
			require.NoError(t, err)
			require.Equal(t, tc.expectedSignature.Type, p.SignatureType)
			require.Equal(t, tc.expectedSignature.Status, p.Signature)
			require.Equal(t, tc.expectedSignature.SigningOrg, p.SignatureOrg)
			require.Equal(t, tc.expectedSignature.Files, p.SignedFiles)
		}
	})
}
