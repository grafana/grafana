package datasources

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDataSource_CustomHeaders(t *testing.T) {
	secretService := secrets.NewFakeSecretsService()

	testValue := "HeaderValue1"

	encryptedValue, err := secretService.Encrypt(context.Background(), []byte(testValue), nil)
	require.NoError(t, err)

	testCases := []struct {
		name             string
		jsonData         *simplejson.Json
		secureJsonData   map[string][]byte
		expectedHeaders  map[string]string
		expectedErrorMsg string
	}{
		{
			name: "valid custom headers",
			jsonData: simplejson.NewFromAny(map[string]interface{}{
				"httpHeaderName1": "X-Test-Header1",
			}),
			secureJsonData: map[string][]byte{
				"httpHeaderValue1": encryptedValue,
			},
			expectedHeaders: map[string]string{
				"X-Test-Header1": testValue,
			},
		},
		{
			name: "missing header value",
			jsonData: simplejson.NewFromAny(map[string]interface{}{
				"httpHeaderName1": "X-Test-Header1",
			}),
			secureJsonData:   map[string][]byte{},
			expectedErrorMsg: "failed to find the value for the declared header field httpHeaderName1",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ds := DataSource{
				JsonData:       tc.jsonData,
				SecureJsonData: tc.secureJsonData,
			}

			headers, err := ds.CustomHeaders(context.Background(), secretService)

			if tc.expectedErrorMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.expectedErrorMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.expectedHeaders, headers)
			}
		})
	}
}
