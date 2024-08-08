package models

import (
	"testing"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
)

func TestReceiver_Clone(t *testing.T) {
	testCases := []struct {
		name     string
		receiver Receiver
	}{
		{name: "empty receiver", receiver: Receiver{}},
		{name: "empty integration", receiver: Receiver{Integrations: []*Integration{{Config: IntegrationConfig{}}}}},
		{name: "random receiver", receiver: ReceiverGen()()},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			receiverClone := tc.receiver.Clone()
			assert.Equal(t, tc.receiver, receiverClone)

			for _, integration := range tc.receiver.Integrations {
				integrationClone := integration.Clone()
				assert.Equal(t, *integration, integrationClone)
			}
		})
	}
}

func TestReceiver_EncryptDecrypt(t *testing.T) {
	encryptFn := Base64Enrypt
	decryptnFn := Base64Decrypt
	// Test that all known integration types encrypt and decrypt their secrets.
	for integrationType, _ := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			decrypedIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()

			encrypted := decrypedIntegration.Clone()
			secrets, err := channels_config.GetSecretKeysForContactPointType(integrationType)
			assert.NoError(t, err)
			for _, key := range secrets {
				if val, ok := encrypted.Settings[key]; ok {
					if s, isString := val.(string); isString {
						encryptedVal, err := encryptFn(s)
						assert.NoError(t, err)
						encrypted.SecureSettings[key] = encryptedVal
						delete(encrypted.Settings, key)
					}
				}
			}

			testIntegration := decrypedIntegration.Clone()
			err = testIntegration.Encrypt(encryptFn)
			assert.NoError(t, err)
			assert.Equal(t, encrypted, testIntegration)

			err = testIntegration.Decrypt(decryptnFn)
			assert.NoError(t, err)
			assert.Equal(t, decrypedIntegration, testIntegration)
		})
	}
}

func TestIntegration_Redact(t *testing.T) {
	redactFn := func(key string) string {
		return "TESTREDACTED"
	}
	// Test that all known integration types redact their secrets.
	for integrationType, _ := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			validIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()

			expected := validIntegration.Clone()
			secrets, err := channels_config.GetSecretKeysForContactPointType(integrationType)
			assert.NoError(t, err)
			for _, key := range secrets {
				if val, ok := expected.Settings[key]; ok {
					if s, isString := val.(string); isString && s != "" {
						expected.Settings[key] = redactFn(s)
						delete(expected.SecureSettings, key)
					}
				}
			}

			validIntegration.Redact(redactFn)

			assert.Equal(t, expected, validIntegration)
		})
	}
}

func TestIntegration_WithExistingSecureFields(t *testing.T) {
	// Test that WithExistingSecureFields will copy over the secure fields from the existing integration.
	testCases := []struct {
		name         string
		integration  Integration
		secureFields []string
		existing     Integration
		expected     Integration
	}{
		{
			name: "test receiver",
			integration: Integration{
				SecureSettings: map[string]string{
					"f1": "newVal1",
					"f2": "newVal2",
					"f3": "newVal3",
					"f5": "newVal5",
				},
			},
			secureFields: []string{"f2", "f4", "f5"},
			existing: Integration{
				SecureSettings: map[string]string{
					"f1": "oldVal1",
					"f2": "oldVal2",
					"f3": "oldVal3",
					"f4": "oldVal4",
				},
			},
			expected: Integration{
				SecureSettings: map[string]string{
					"f1": "newVal1",
					"f2": "oldVal2",
					"f3": "newVal3",
					"f4": "oldVal4",
				},
			},
		},
		{
			name: "Integration[exists], SecureFields[true], Existing[exists]: old value",
			integration: Integration{
				SecureSettings: map[string]string{"f1": "newVal1"},
			},
			secureFields: []string{"f1"},
			existing:     Integration{SecureSettings: map[string]string{"f1": "oldVal1"}},
			expected:     Integration{SecureSettings: map[string]string{"f1": "oldVal1"}},
		},
		{
			name: "Integration[exists], SecureFields[true], Existing[missing]: no value",
			integration: Integration{
				SecureSettings: map[string]string{"f1": "newVal1"},
			},
			secureFields: []string{"f1"},
			existing:     Integration{SecureSettings: map[string]string{}},
			expected:     Integration{SecureSettings: map[string]string{}},
		},

		{
			name: "Integration[exists], SecureFields[false], Existing[exists]: new value",
			integration: Integration{
				SecureSettings: map[string]string{"f1": "newVal1"},
			},
			existing: Integration{SecureSettings: map[string]string{"f1": "oldVal1"}},
			expected: Integration{SecureSettings: map[string]string{"f1": "newVal1"}},
		},
		{
			name: "Integration[exists], SecureFields[false], Existing[missing]: new value",
			integration: Integration{
				SecureSettings: map[string]string{"f1": "newVal1"},
			},
			existing: Integration{SecureSettings: map[string]string{}},
			expected: Integration{SecureSettings: map[string]string{"f1": "newVal1"}},
		},

		{
			name: "Integration[missing], SecureFields[true], Existing[exists]: old value",
			integration: Integration{
				SecureSettings: map[string]string{},
			},
			secureFields: []string{"f1"},
			existing:     Integration{SecureSettings: map[string]string{"f1": "oldVal1"}},
			expected:     Integration{SecureSettings: map[string]string{"f1": "oldVal1"}},
		},
		{
			name: "Integration[missing], SecureFields[true], Existing[missing]: no value",
			integration: Integration{
				SecureSettings: map[string]string{},
			},
			secureFields: []string{"f1"},
			existing:     Integration{SecureSettings: map[string]string{}},
			expected:     Integration{SecureSettings: map[string]string{}},
		},

		{
			name: "Integration[missing], SecureFields[false], Existing[exists]: no value",
			integration: Integration{
				SecureSettings: map[string]string{},
			},
			existing: Integration{SecureSettings: map[string]string{"f1": "oldVal1"}},
			expected: Integration{SecureSettings: map[string]string{}},
		},
		{
			name: "Integration[missing], SecureFields[false], Existing[missing]: no value",
			integration: Integration{
				SecureSettings: map[string]string{},
			},
			existing: Integration{SecureSettings: map[string]string{}},
			expected: Integration{SecureSettings: map[string]string{}},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tc.integration.WithExistingSecureFields(&tc.existing, tc.secureFields)
			assert.Equal(t, tc.expected, tc.integration)
		})
	}
}

func TestIntegrationConfig(t *testing.T) {
	// Test that all known integration types have a config and correctly mark their secrets as secure.
	for integrationType, _ := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			config, err := IntegrationConfigFromType(integrationType)
			assert.NoError(t, err)

			secrets, err := channels_config.GetSecretKeysForContactPointType(integrationType)
			assert.NoError(t, err)
			allSecrets := make(map[string]struct{}, len(secrets))
			for _, key := range secrets {
				allSecrets[key] = struct{}{}
			}

			for field := range config.Fields {
				_, isSecret := allSecrets[field]
				assert.Equal(t, isSecret, config.IsSecureField(field))
			}
			assert.False(t, config.IsSecureField("__--**unknown_field**--__"))
		})
	}

	t.Run("Unknown type returns error", func(t *testing.T) {
		_, err := IntegrationConfigFromType("__--**unknown_type**--__")
		assert.Error(t, err)
	})
}

func TestIntegration_SecureFields(t *testing.T) {
	// Test that all known integration types have a config and correctly mark their secrets as secure.
	for integrationType, _ := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			t.Run("contains SecureSettings", func(t *testing.T) {
				validIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()
				expected := make(map[string]bool, len(validIntegration.SecureSettings))
				for field := range validIntegration.Config.Fields {
					if validIntegration.Config.IsSecureField(field) {
						expected[field] = true
						validIntegration.SecureSettings[field] = "test"
						delete(validIntegration.Settings, field)
					}
				}
				assert.Equal(t, expected, validIntegration.SecureFields())
			})

			t.Run("contains secret Settings not in SecureSettings", func(t *testing.T) {
				validIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()
				expected := make(map[string]bool, len(validIntegration.SecureSettings))
				for field := range validIntegration.Config.Fields {
					if validIntegration.Config.IsSecureField(field) {
						expected[field] = true
						validIntegration.Settings[field] = "test"
						delete(validIntegration.SecureSettings, field)
					}
				}
				assert.Equal(t, expected, validIntegration.SecureFields())
			})
		})
	}
}
