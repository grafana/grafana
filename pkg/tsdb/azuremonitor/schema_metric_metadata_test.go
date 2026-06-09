package azuremonitor

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEncodeDecodeDimensionColumnName(t *testing.T) {
	t.Run("plain identifiers are human readable", func(t *testing.T) {
		for _, c := range []string{"VMName", "LUN", "Microsoft.ResourceId", "node-1"} {
			enc := encodeDimensionColumnName(c)
			require.Equal(t, dimensionIdentifierPrefix+c, enc)
			dec, ok := decodeDimensionColumnName(enc)
			require.True(t, ok)
			require.Equal(t, c, dec)
		}
	})
	t.Run("non plain keys use b64 suffix", func(t *testing.T) {
		for _, c := range []string{
			"Microsoft.Compute/virtualMachines",
			"Percentage CPU",
			"dim/with/slashes",
		} {
			enc := encodeDimensionColumnName(c)
			require.True(t, strings.HasPrefix(enc, dimensionB64Prefix), enc)
			dec, ok := decodeDimensionColumnName(enc)
			require.True(t, ok)
			require.Equal(t, c, dec)
		}
	})
	t.Run("legacy dimension_<base64> still decodes", func(t *testing.T) {
		legacy := dimensionColumnPrefix + "UGVyY2VudGFnZSBDUFU" // "Percentage CPU" base64url
		dec, ok := decodeDimensionColumnName(legacy)
		require.True(t, ok)
		require.Equal(t, "Percentage CPU", dec)
	})
	_, ok := decodeDimensionColumnName("aggregation")
	require.False(t, ok)
}

func TestParseMetadataDimensionValues(t *testing.T) {
	body := []byte(`{
  "value": [
    {
      "timeseries": [
        {
          "metadatavalues": [
            {"name": {"value": "VMName"}, "value": "vm-a"},
            {"name": {"value": "VMName"}, "value": "vm-b"},
            {"name": {"value": "Other"}, "value": "x"}
          ]
        }
      ]
    }
  ]
}`)
	vals, err := parseMetadataDimensionValues(body, "VMName")
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"vm-a", "vm-b"}, vals)
}
