package channels_config

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetSecretKeysForContactPointType(t *testing.T) {
	commonHttpClientOptionSecrets := []string{
		"http_config.oauth2.client_secret",
		"http_config.oauth2.tls_config.caCertificate",
		"http_config.oauth2.tls_config.clientCertificate",
		"http_config.oauth2.tls_config.clientKey",
	}
	testCases := []struct {
		receiverType         string
		expectedSecretFields []string
		skipCommonSecrets    bool
	}{
		{receiverType: "dingding", expectedSecretFields: []string{"url"}},
		{receiverType: "kafka", expectedSecretFields: []string{"password"}},
		{receiverType: "email", expectedSecretFields: []string{}, skipCommonSecrets: true},
		{receiverType: "pagerduty", expectedSecretFields: []string{"integrationKey"}},
		{receiverType: "victorops", expectedSecretFields: []string{"url"}},
		{receiverType: "oncall", expectedSecretFields: []string{"password", "authorization_credentials"}},
		{receiverType: "pushover", expectedSecretFields: []string{"apiToken", "userKey"}},
		{receiverType: "slack", expectedSecretFields: []string{"token", "url"}, skipCommonSecrets: true},
		{receiverType: "sensugo", expectedSecretFields: []string{"apikey"}},
		{receiverType: "teams", expectedSecretFields: []string{}},
		{receiverType: "telegram", expectedSecretFields: []string{"bottoken"}},
		{receiverType: "webhook", expectedSecretFields: []string{
			"password",
			"authorization_credentials",
			"tlsConfig.caCertificate",
			"tlsConfig.clientCertificate",
			"tlsConfig.clientKey",
			"hmacConfig.secret",
		}},
		{receiverType: "wecom", expectedSecretFields: []string{"url", "secret"}},
		{receiverType: "prometheus-alertmanager", expectedSecretFields: []string{"basicAuthPassword"}, skipCommonSecrets: true},
		{receiverType: "discord", expectedSecretFields: []string{"url"}},
		{receiverType: "googlechat", expectedSecretFields: []string{"url"}},
		{receiverType: "LINE", expectedSecretFields: []string{"token"}},
		{receiverType: "threema", expectedSecretFields: []string{"api_secret"}},
		{receiverType: "opsgenie", expectedSecretFields: []string{"apiKey"}},
		{receiverType: "webex", expectedSecretFields: []string{"bot_token"}},
		{receiverType: "sns", expectedSecretFields: []string{"sigv4.access_key", "sigv4.secret_key"}, skipCommonSecrets: true},
		{receiverType: "mqtt", expectedSecretFields: []string{"password", "tlsConfig.caCertificate", "tlsConfig.clientCertificate", "tlsConfig.clientKey"}, skipCommonSecrets: true},
		{receiverType: "jira", expectedSecretFields: []string{"user", "password", "api_token"}},
	}
	n := GetAvailableNotifiers()
	allTypes := make(map[string]struct{}, len(n))
	for _, plugin := range n {
		allTypes[plugin.Type] = struct{}{}
	}

	for _, testCase := range testCases {
		delete(allTypes, testCase.receiverType)
		t.Run(testCase.receiverType, func(t *testing.T) {
			got, err := GetSecretKeysForContactPointType(testCase.receiverType)
			require.NoError(t, err)
			expectedSecretFields := testCase.expectedSecretFields
			if !testCase.skipCommonSecrets {
				expectedSecretFields = slices.Concat(testCase.expectedSecretFields, commonHttpClientOptionSecrets)
			}
			require.ElementsMatch(t, expectedSecretFields, got)
		})
	}

	for integrationType := range allTypes {
		t.Run(integrationType, func(t *testing.T) {
			got, err := GetSecretKeysForContactPointType(integrationType)
			require.NoError(t, err)
			require.Emptyf(t, got, "secret keys for %s should be empty", integrationType)
		})
	}

	require.Emptyf(t, allTypes, "not all types are covered: %s", allTypes)
}

func Test_getSecretFields(t *testing.T) {
	testCases := []struct {
		name           string
		parentPath     string
		options        []NotifierOption
		expectedFields []string
	}{
		{
			name:       "No secure fields",
			parentPath: "",
			options: []NotifierOption{
				{PropertyName: "field1", Secure: false, SubformOptions: nil},
				{PropertyName: "field2", Secure: false, SubformOptions: nil},
			},
			expectedFields: []string{},
		},
		{
			name:       "Single secure field",
			parentPath: "",
			options: []NotifierOption{
				{PropertyName: "field1", Secure: true, SubformOptions: nil},
				{PropertyName: "field2", Secure: false, SubformOptions: nil},
			},
			expectedFields: []string{"field1"},
		},
		{
			name:       "Secure field in subform",
			parentPath: "parent",
			options: []NotifierOption{
				{PropertyName: "field1", Secure: true, SubformOptions: nil},
				{PropertyName: "field2", Secure: false, SubformOptions: []NotifierOption{
					{PropertyName: "subfield1", Secure: true, SubformOptions: nil},
				}},
			},
			expectedFields: []string{"parent.field1", "parent.field2.subfield1"},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := getSecretFields(tc.parentPath, tc.options)
			require.ElementsMatch(t, got, tc.expectedFields)
		})
	}
}
