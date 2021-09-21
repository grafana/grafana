package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAzureSettings(t *testing.T) {
	t.Run("cloud name", func(t *testing.T) {
		testCases := []struct {
			name            string
			configuredValue string
			resolvedValue   string
		}{
			{
				name:            "should be Public if not set",
				configuredValue: "",
				resolvedValue:   AzurePublic,
			},
			{
				name:            "should be Public if set to Public",
				configuredValue: AzurePublic,
				resolvedValue:   AzurePublic,
			},
			{
				name:            "should be Public if set to Public using alternative name",
				configuredValue: "AzurePublicCloud",
				resolvedValue:   AzurePublic,
			},
			{
				name:            "should be China if set to China",
				configuredValue: AzureChina,
				resolvedValue:   AzureChina,
			},
			{
				name:            "should be US Government if set to US Government using alternative name",
				configuredValue: "usgov",
				resolvedValue:   AzureUSGovernment,
			},
			{
				name:            "should be same as set if not known",
				configuredValue: "Custom123",
				resolvedValue:   "Custom123",
			},
		}

		for _, c := range testCases {
			t.Run(c.name, func(t *testing.T) {
				cfg := NewCfg()

				azureSection, err := cfg.Raw.NewSection("azure")
				require.NoError(t, err)
				_, err = azureSection.NewKey("cloud", c.configuredValue)
				require.NoError(t, err)

				cfg.readAzureSettings()
				require.NotNil(t, cfg.Azure)

				assert.Equal(t, c.resolvedValue, cfg.Azure.Cloud)
			})
		}
	})
}
