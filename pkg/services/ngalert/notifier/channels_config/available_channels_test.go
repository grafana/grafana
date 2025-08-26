package channels_config

import (
	"encoding/json"
	"fmt"
	"maps"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/grafana/alerting/notify/notifytest"
	"github.com/stretchr/testify/require"
)

func TestGetSecretKeysForContactPointType(t *testing.T) {
	httpConfigSecrets := []string{"http_config.authorization.credentials", "http_config.basic_auth.password", "http_config.oauth2.client_secret"}
	testCases := []struct {
		receiverType         string
		version              string
		expectedSecretFields []string
	}{
		{receiverType: "dingding", version: "v1", expectedSecretFields: []string{"url"}},
		{receiverType: "kafka", version: "v1", expectedSecretFields: []string{"password"}},
		{receiverType: "email", version: "v1", expectedSecretFields: []string{}},
		{receiverType: "pagerduty", version: "v1", expectedSecretFields: []string{"integrationKey"}},
		{receiverType: "victorops", version: "v1", expectedSecretFields: []string{"url"}},
		{receiverType: "oncall", version: "v1", expectedSecretFields: []string{"password", "authorization_credentials"}},
		{receiverType: "pushover", version: "v1", expectedSecretFields: []string{"apiToken", "userKey"}},
		{receiverType: "slack", version: "v1", expectedSecretFields: []string{"token", "url"}},
		{receiverType: "sensugo", version: "v1", expectedSecretFields: []string{"apikey"}},
		{receiverType: "teams", version: "v1", expectedSecretFields: []string{}},
		{receiverType: "telegram", version: "v1", expectedSecretFields: []string{"bottoken"}},
		{receiverType: "webhook", version: "v1", expectedSecretFields: []string{
			"password",
			"authorization_credentials",
			"tlsConfig.caCertificate",
			"tlsConfig.clientCertificate",
			"tlsConfig.clientKey",
			"hmacConfig.secret",
			"http_config.oauth2.client_secret",
			"http_config.oauth2.tls_config.caCertificate",
			"http_config.oauth2.tls_config.clientCertificate",
			"http_config.oauth2.tls_config.clientKey",
		}},
		{receiverType: "wecom", version: "v1", expectedSecretFields: []string{"url", "secret"}},
		{receiverType: "prometheus-alertmanager", version: "v1", expectedSecretFields: []string{"basicAuthPassword"}},
		{receiverType: "discord", version: "v1", expectedSecretFields: []string{"url"}},
		{receiverType: "googlechat", version: "v1", expectedSecretFields: []string{"url"}},
		{receiverType: "LINE", version: "v1", expectedSecretFields: []string{"token"}},
		{receiverType: "threema", version: "v1", expectedSecretFields: []string{"api_secret"}},
		{receiverType: "opsgenie", version: "v1", expectedSecretFields: []string{"apiKey"}},
		{receiverType: "webex", version: "v1", expectedSecretFields: []string{"bot_token"}},
		{receiverType: "sns", version: "v1", expectedSecretFields: []string{"sigv4.access_key", "sigv4.secret_key"}},
		{receiverType: "mqtt", version: "v1", expectedSecretFields: []string{"password", "tlsConfig.caCertificate", "tlsConfig.clientCertificate", "tlsConfig.clientKey"}},
		{receiverType: "jira", version: "v1", expectedSecretFields: []string{"user", "password", "api_token"}},
		{receiverType: "victorops", version: "v0", expectedSecretFields: append([]string{"api_key"}, httpConfigSecrets...)},
		{receiverType: "sns", version: "v0", expectedSecretFields: append([]string{"sigv4.SecretKey"}, httpConfigSecrets...)},
		{receiverType: "telegram", version: "v0", expectedSecretFields: append([]string{"token"}, httpConfigSecrets...)},
		{receiverType: "discord", version: "v0", expectedSecretFields: append([]string{"webhook_url"}, httpConfigSecrets...)},
		{receiverType: "pagerduty", version: "v0", expectedSecretFields: append([]string{"routing_key", "service_key"}, httpConfigSecrets...)},
		{receiverType: "pushover", version: "v0", expectedSecretFields: append([]string{"user_key", "token"}, httpConfigSecrets...)},
		{receiverType: "jira", version: "v0", expectedSecretFields: httpConfigSecrets},
		{receiverType: "opsgenie", version: "v0", expectedSecretFields: append([]string{"api_key"}, httpConfigSecrets...)},
		{receiverType: "msteams", version: "v0", expectedSecretFields: append([]string{"webhook_url"}, httpConfigSecrets...)},
		{receiverType: "email", version: "v0", expectedSecretFields: []string{"auth_password", "auth_secret"}},
		{receiverType: "slack", version: "v0", expectedSecretFields: append([]string{"api_url"}, httpConfigSecrets...)},
		{receiverType: "webex", version: "v0", expectedSecretFields: httpConfigSecrets},
		{receiverType: "wechat", version: "v0", expectedSecretFields: append([]string{"api_secret"}, httpConfigSecrets...)},
		{receiverType: "webhook", version: "v0", expectedSecretFields: append([]string{"url"}, httpConfigSecrets...)},
	}
	n := slices.Collect(GetAvailableNotifiersV2())
	type typeWithVersion struct {
		Type    string
		Version string
	}
	allTypes := make(map[typeWithVersion]struct{}, len(n))
	getKey := func(pluginType, version string) typeWithVersion { return typeWithVersion{pluginType, version} }
	for _, p := range n {
		for _, v := range p.Versions {
			allTypes[getKey(p.Type, v.Version)] = struct{}{}
		}
	}

	for _, testCase := range testCases {
		delete(allTypes, getKey(testCase.receiverType, testCase.version))
		t.Run(fmt.Sprintf("%s-%s", testCase.receiverType, testCase.version), func(t *testing.T) {
			got, err := GetSecretKeysForContactPointType(testCase.receiverType, testCase.version)
			require.NoError(t, err)
			require.ElementsMatch(t, testCase.expectedSecretFields, got)
		})
	}

	for it := range allTypes {
		t.Run(fmt.Sprintf("%s-%s", it.Type, it.Version), func(t *testing.T) {
			got, err := GetSecretKeysForContactPointType(it.Type, it.Version)
			require.NoError(t, err)
			require.Emptyf(t, got, "secret keys for version %s of %s should be empty", it.Version, it.Type)
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

func TestPostableMimirReceiverToIntegrations(t *testing.T) {
	notifytest.ForEachIntegrationType(t, func(configType reflect.Type) {
		t.Run(configType.Name(), func(t *testing.T) {
			integrationType := strings.ToLower(strings.TrimSuffix(configType.Name(), "Config"))
			expectedSecrets, err := GetSecretKeysForContactPointType(integrationType, "v0")

			require.NoError(t, err)
			var secrets []string
			for option := range maps.Keys(notifytest.ValidMimirHTTPConfigs) {
				cfg, err := notifytest.GetMimirIntegrationForType(configType, option)
				require.NoError(t, err)
				data, err := json.Marshal(cfg)
				require.NoError(t, err)
				m := map[string]any{}
				err = json.Unmarshal(data, &m)
				secrets = append(secrets, getSecrets(m, "")...)
			}
			secrets = unique(secrets)
			t.Log(secrets)
			require.ElementsMatch(t, expectedSecrets, secrets)
		})
	})
}

func unique(slice []string) []string {
	keys := make(map[string]struct{}, len(slice))
	list := make([]string, 0, len(slice))
	for _, entry := range slice {
		if _, value := keys[entry]; !value {
			keys[entry] = struct{}{}
			list = append(list, entry)
		}
	}
	return list
}

func getSecrets(m map[string]any, parent string) []string {
	var result []string
	for key, val := range m {
		str, ok := val.(string)
		if ok && str == "<secret>" {
			result = append(result, parent+key)
		}
		m, ok := val.(map[string]any)
		if ok {
			subSecrets := getSecrets(m, parent+key+".")
			result = append(result, subSecrets...)
		}
	}
	return result
}
