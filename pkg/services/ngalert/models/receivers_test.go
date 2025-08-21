package models

import (
	"maps"
	"reflect"
	"testing"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/util"
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
	for integrationType := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			decrypedIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()

			encrypted := decrypedIntegration.Clone()
			secrets, err := channels_config.GetSecretKeysForContactPointType(integrationType)
			assert.NoError(t, err)
			for _, key := range secrets {
				val, ok, err := extractField(encrypted.Settings, NewIntegrationFieldPath(key))
				assert.NoError(t, err)
				if ok {
					encryptedVal, err := encryptFn(val)
					assert.NoError(t, err)
					encrypted.SecureSettings[key] = encryptedVal
				}
			}

			testIntegration := decrypedIntegration.Clone()
			err = testIntegration.Encrypt(encryptFn)
			assert.NoError(t, err)
			require.Equal(t, encrypted, testIntegration)

			err = testIntegration.Decrypt(decryptnFn)
			assert.NoError(t, err)
			assert.Equal(t, decrypedIntegration, testIntegration)
		})
	}
}

func TestIntegration_Redact(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	redactFn := func(key string) string {
		return "TESTREDACTED"
	}
	// Test that all known integration types redact their secrets.
	for integrationType := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			validIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()

			expected := validIntegration.Clone()
			secrets, err := channels_config.GetSecretKeysForContactPointType(integrationType)
			assert.NoError(t, err)
			for _, key := range secrets {
				err := setField(expected.Settings, NewIntegrationFieldPath(key), func(current any) any {
					if s, isString := current.(string); isString && s != "" {
						delete(expected.SecureSettings, key)
						return redactFn(s)
					}
					return current
				}, true)
				require.NoError(t, err)
			}

			validIntegration.Redact(redactFn)

			assert.Equal(t, expected, validIntegration)
		})
	}
}

func TestIntegration_Validate(t *testing.T) {
	// Test that all known integration types are valid.
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	for integrationType := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			validIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()
			assert.NoError(t, validIntegration.Encrypt(Base64Enrypt))
			assert.NoErrorf(t, validIntegration.Validate(Base64Decrypt), "integration should be valid")

			invalidIntegration := IntegrationGen(IntegrationMuts.WithInvalidConfig(integrationType))()
			assert.NoError(t, invalidIntegration.Encrypt(Base64Enrypt))
			assert.Errorf(t, invalidIntegration.Validate(Base64Decrypt), "integration should be invalid")
		})
	}
}

func TestIntegration_WithExistingSecureFields(t *testing.T) {
	// Test that WithExistingSecureFields will copy over the secure fields from the existing integration.
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

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

func TestSecretsIntegrationConfig(t *testing.T) {
	// Test that all known integration types have a config and correctly mark their secrets as secure.
	for integrationType := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			config, err := IntegrationConfigFromType(integrationType, nil)
			assert.NoError(t, err)

			t.Run("v1 is current", func(t *testing.T) {
				configv1, err := IntegrationConfigFromType(integrationType, util.Pointer("v1"))
				assert.NoError(t, err)
				assert.Equal(t, config, configv1)
			})

			secrets, err := channels_config.GetSecretKeysForContactPointType(integrationType)
			assert.NoError(t, err)
			allSecrets := make(map[string]struct{}, len(secrets))
			for _, key := range secrets {
				allSecrets[key] = struct{}{}
			}

			secretFields := config.GetSecretFields()
			for _, path := range secretFields {
				_, isSecret := allSecrets[path.String()]
				assert.Equalf(t, isSecret, config.IsSecureField(path), "field '%s' is expected to be secret", path)
				delete(allSecrets, path.String())
			}
			assert.False(t, config.IsSecureField(IntegrationFieldPath{"__--**unknown_field**--__"}))
			assert.Empty(t, allSecrets, "mismatched secret fields for integration type %s: %v", integrationType, allSecrets)
		})
	}

	t.Run("Unknown type returns error", func(t *testing.T) {
		_, err := IntegrationConfigFromType("__--**unknown_type**--__", nil)
		assert.Error(t, err)
	})

	t.Run("Unknown version returns error", func(t *testing.T) {
		maps.Keys(alertingNotify.AllKnownConfigsForTesting)
		_, err := IntegrationConfigFromType("__--**unknown_type**--__", nil)
		assert.Error(t, err)
	})
}

func TestIntegration_SecureFields(t *testing.T) {
	// Test that all known integration types have a config and correctly mark their secrets as secure.
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	for integrationType := range alertingNotify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			t.Run("contains SecureSettings", func(t *testing.T) {
				validIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()
				expected := make(map[string]bool, len(validIntegration.SecureSettings))
				for _, path := range validIntegration.Config.GetSecretFields() {
					if validIntegration.Config.IsSecureField(path) {
						expected[path.String()] = true
						validIntegration.SecureSettings[path.String()] = "test"
						_, _, err := extractField(validIntegration.Settings, path)
						require.NoError(t, err)
						continue
					}
				}
				assert.Equal(t, expected, validIntegration.SecureFields())
			})

			t.Run("contains secret Settings not in SecureSettings", func(t *testing.T) {
				validIntegration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()
				expected := make(map[string]bool, len(validIntegration.SecureSettings))
				for _, path := range validIntegration.Config.GetSecretFields() {
					if validIntegration.Config.IsSecureField(path) {
						expected[path.String()] = true
						assert.NoError(t, setField(validIntegration.Settings, path, func(current any) any {
							return "test"
						}, false))
						delete(validIntegration.SecureSettings, path.String())
					}
				}
				assert.Equal(t, expected, validIntegration.SecureFields())
			})
		})
	}
}

// This is a broken type that will error if marshalled.
type broken struct {
	f1 string
}

func (b broken) MarshalJSON() ([]byte, error) {
	return nil, assert.AnError
}

func TestReceiver_Fingerprint(t *testing.T) {
	// Test that the fingerprint is stable.
	im := IntegrationMuts
	baseReceiver := ReceiverGen(ReceiverMuts.WithName("test receiver"), ReceiverMuts.WithIntegrations(
		IntegrationGen(im.WithName("test receiver"), im.WithValidConfig("slack"))(),
	))()
	baseReceiver.Integrations[0].UID = "stable UID"
	baseReceiver.Integrations[0].DisableResolveMessage = true
	baseReceiver.Integrations[0].SecureSettings = map[string]string{"test2": "test2", "test3": "test223", "test1": "rest22"}
	baseReceiver.Integrations[0].Settings["broken"] = broken{f1: "this"} // Add a broken type to ensure it is stable in the fingerprint.
	baseReceiver.Integrations[0].Settings["sub-map"] = map[string]any{
		"setting":   "value",
		"something": 123,
		"data":      []string{"test"},
	} // Add a broken type to ensure it is stable in the fingerprint.
	baseReceiver.Integrations[0].Config = IntegrationConfig{Type: baseReceiver.Integrations[0].Config.Type} // Remove all fields except Type.

	completelyDifferentReceiver := ReceiverGen(ReceiverMuts.WithName("test receiver2"), ReceiverMuts.WithIntegrations(
		IntegrationGen(im.WithName("test receiver2"), im.WithValidConfig("discord"))(),
	))()
	completelyDifferentReceiver.Integrations[0].UID = "stable UID2"
	completelyDifferentReceiver.Integrations[0].DisableResolveMessage = false
	completelyDifferentReceiver.Integrations[0].SecureSettings = map[string]string{"test": "test"}
	completelyDifferentReceiver.Provenance = ProvenanceAPI
	completelyDifferentReceiver.Integrations[0].Config = IntegrationConfig{Type: completelyDifferentReceiver.Integrations[0].Config.Type} // Remove all fields except Type.

	t.Run("stable across code changes", func(t *testing.T) {
		expectedFingerprint := "c0c82936be34b183" // If this is a valid fingerprint generation change, update the expected value.
		assert.Equal(t, expectedFingerprint, baseReceiver.Fingerprint())
	})
	t.Run("stable across clones", func(t *testing.T) {
		fingerprint := baseReceiver.Fingerprint()
		receiverClone := baseReceiver.Clone()
		assert.Equal(t, fingerprint, receiverClone.Fingerprint())
	})
	t.Run("stable across Version field modification", func(t *testing.T) {
		fingerprint := baseReceiver.Fingerprint()
		receiverClone := baseReceiver.Clone()
		receiverClone.Version = "new version"
		assert.Equal(t, fingerprint, receiverClone.Fingerprint())
	})
	t.Run("unstable across field modification", func(t *testing.T) {
		fingerprint := baseReceiver.Fingerprint()
		excludedFields := map[string]struct{}{
			"Version": {},
		}

		reflectVal := reflect.ValueOf(&completelyDifferentReceiver).Elem()

		receiverType := reflect.TypeOf((*Receiver)(nil)).Elem()
		for i := 0; i < receiverType.NumField(); i++ {
			field := receiverType.Field(i).Name
			if _, ok := excludedFields[field]; ok {
				continue
			}
			cp := baseReceiver.Clone()

			// Get the current field being modified.
			v := reflect.ValueOf(&cp).Elem()
			vf := v.Field(i)

			otherField := reflectVal.Field(i)
			if reflect.DeepEqual(otherField.Interface(), vf.Interface()) {
				assert.Failf(t, "filds are identical", "Receiver field %s is the same as the original, test does not ensure instability across the field", field)
				continue
			}

			// Set the field to the value of the completelyDifferentReceiver.
			vf.Set(otherField)

			f2 := cp.Fingerprint()
			assert.NotEqualf(t, fingerprint, f2, "Receiver field %s does not seem to be used in fingerprint", field)
		}

		excludedFields = map[string]struct{}{}

		reflectVal = reflect.ValueOf(completelyDifferentReceiver.Integrations[0]).Elem()
		integrationType := reflect.TypeOf((*Integration)(nil)).Elem()
		for i := 0; i < integrationType.NumField(); i++ {
			field := integrationType.Field(i).Name
			if _, ok := excludedFields[field]; ok {
				continue
			}
			cp := baseReceiver.Clone()
			integrationCp := cp.Integrations[0]

			// Get the current field being modified.
			v := reflect.ValueOf(integrationCp).Elem()
			vf := v.Field(i)

			otherField := reflectVal.Field(i)
			if reflect.DeepEqual(otherField.Interface(), vf.Interface()) {
				assert.Failf(t, "filds are identical", "Integration field %s is the same as the original, test does not ensure instability across the field", field)
				continue
			}

			// Set the field to the value of the completelyDifferentReceiver.
			vf.Set(otherField)

			f2 := cp.Fingerprint()
			assert.NotEqualf(t, fingerprint, f2, "Integration field %s does not seem to be used in fingerprint", field)
		}
	})
}
