package channels_config

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetSecretKeysForContactPointType(t *testing.T) {
	testCases := []struct {
		receiverType         string
		expectedSecretFields []string
	}{
		{receiverType: "dingding", expectedSecretFields: []string{}},
		{receiverType: "kafka", expectedSecretFields: []string{"password"}},
		{receiverType: "email", expectedSecretFields: []string{}},
		{receiverType: "pagerduty", expectedSecretFields: []string{"integrationKey"}},
		{receiverType: "victorops", expectedSecretFields: []string{}},
		{receiverType: "oncall", expectedSecretFields: []string{"password", "authorization_credentials"}},
		{receiverType: "pushover", expectedSecretFields: []string{"apiToken", "userKey"}},
		{receiverType: "slack", expectedSecretFields: []string{"token", "url"}},
		{receiverType: "sensugo", expectedSecretFields: []string{"apikey"}},
		{receiverType: "teams", expectedSecretFields: []string{}},
		{receiverType: "telegram", expectedSecretFields: []string{"bottoken"}},
		{receiverType: "webhook", expectedSecretFields: []string{"password", "authorization_credentials"}},
		{receiverType: "wecom", expectedSecretFields: []string{"url", "secret"}},
		{receiverType: "prometheus-alertmanager", expectedSecretFields: []string{"basicAuthPassword"}},
		{receiverType: "discord", expectedSecretFields: []string{"url"}},
		{receiverType: "googlechat", expectedSecretFields: []string{}},
		{receiverType: "line", expectedSecretFields: []string{"token"}},
		{receiverType: "threema", expectedSecretFields: []string{"api_secret"}},
		{receiverType: "opsgenie", expectedSecretFields: []string{"apiKey"}},
		{receiverType: "webex", expectedSecretFields: []string{"bot_token"}},
		{receiverType: "sns", expectedSecretFields: []string{"sigv4.access_key", "sigv4.secret_key"}},
	}
	for _, testCase := range testCases {
		t.Run(testCase.receiverType, func(t *testing.T) {
			got, err := GetSecretKeysForContactPointType(testCase.receiverType)
			require.NoError(t, err)
			t.Logf("got secret fields: %#v", got)
			require.ElementsMatch(t, testCase.expectedSecretFields, got)
		})
	}
}
