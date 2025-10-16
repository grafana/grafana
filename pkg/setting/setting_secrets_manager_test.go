package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadSecretsManagerSettings(t *testing.T) {
	t.Run("should parse basic encryption provider", func(t *testing.T) {
		iniContent := `
[secrets_manager]
encryption_provider = aws_kms
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, "aws_kms", cfg.SecretsManagement.CurrentEncryptionProvider)
		assert.Empty(t, cfg.SecretsManagement.ConfiguredKMSProviders)
	})

	t.Run("should parse single KMS provider configuration", func(t *testing.T) {
		iniContent := `
[secrets_manager]
encryption_provider = aws_kms.v1

[secrets_manager.encryption.aws_kms.v1]
region = us-east-1
key_id = arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, "aws_kms.v1", cfg.SecretsManagement.CurrentEncryptionProvider)
		assert.Len(t, cfg.SecretsManagement.ConfiguredKMSProviders, 1)

		awsProvider := cfg.SecretsManagement.ConfiguredKMSProviders["aws_kms.v1"]
		assert.Equal(t, "us-east-1", awsProvider["region"])
		assert.Equal(t, "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012", awsProvider["key_id"])
	})

	t.Run("should parse multiple KMS providers", func(t *testing.T) {
		iniContent := `
[secrets_manager]
encryption_provider = aws_kms.v1

[secrets_manager.encryption.aws_kms.v1]
region = us-east-1
key_id = arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012

[secrets_manager.encryption.azure_kv.v1]
vault_url = https://myvault.vault.azure.net/
key_name = mykey
tenant_id = 12345678-1234-1234-1234-123456789012

[secrets_manager.encryption.secret_key.v1]
key = my-secret-key
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, "aws_kms.v1", cfg.SecretsManagement.CurrentEncryptionProvider)
		assert.Len(t, cfg.SecretsManagement.ConfiguredKMSProviders, 3)

		// Check AWS KMS provider
		awsProvider := cfg.SecretsManagement.ConfiguredKMSProviders["aws_kms.v1"]
		assert.Equal(t, "us-east-1", awsProvider["region"])
		assert.Equal(t, "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012", awsProvider["key_id"])

		// Check Azure Key Vault provider
		azureProvider := cfg.SecretsManagement.ConfiguredKMSProviders["azure_kv.v1"]
		assert.Equal(t, "https://myvault.vault.azure.net/", azureProvider["vault_url"])
		assert.Equal(t, "mykey", azureProvider["key_name"])
		assert.Equal(t, "12345678-1234-1234-1234-123456789012", azureProvider["tenant_id"])

		// Check secret key provider
		secretProvider := cfg.SecretsManagement.ConfiguredKMSProviders["secret_key.v1"]
		assert.Equal(t, "my-secret-key", secretProvider["key"])
	})

	t.Run("should default to misconfigured provider when no encryption_provider is set", func(t *testing.T) {
		iniContent := `
[secrets_manager]
# no encryption_provider setting
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, MisconfiguredProvider, cfg.SecretsManagement.CurrentEncryptionProvider)
	})

	t.Run("should handle empty sections gracefully", func(t *testing.T) {
		iniContent := `
[secrets_manager]
encryption_provider = empty_provider

[secrets_manager.encryption.empty_provider]
# empty section
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, "empty_provider", cfg.SecretsManagement.CurrentEncryptionProvider)
		assert.Len(t, cfg.SecretsManagement.ConfiguredKMSProviders, 1)

		emptyProvider := cfg.SecretsManagement.ConfiguredKMSProviders["empty_provider"]
		assert.NotNil(t, emptyProvider)
		assert.Empty(t, emptyProvider)
	})

	t.Run("should ignore sections that don't match provider prefix", func(t *testing.T) {
		iniContent := `
[secrets_manager]
encryption_provider = aws_kms.v1

[secrets_manager.encryption.valid_provider]
key = value

[secrets_manager.other_section]
setting = value

[completely_different_section]
some_setting = some_value
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, "aws_kms.v1", cfg.SecretsManagement.CurrentEncryptionProvider)
		assert.Len(t, cfg.SecretsManagement.ConfiguredKMSProviders, 1)

		validProvider := cfg.SecretsManagement.ConfiguredKMSProviders["valid_provider"]
		assert.Equal(t, "value", validProvider["key"])
	})

	t.Run("should handle provider names with special characters", func(t *testing.T) {
		iniContent := `
[secrets_manager]
encryption_provider = aws_kms.v1

[secrets_manager.encryption.aws_kms.v1]
region = us-west-2
key_id = test-key

[secrets_manager.encryption.azure_kv.v1]
vault_url = https://test.vault.azure.net/
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, "aws_kms.v1", cfg.SecretsManagement.CurrentEncryptionProvider)
		assert.Len(t, cfg.SecretsManagement.ConfiguredKMSProviders, 2)

		awsProvider := cfg.SecretsManagement.ConfiguredKMSProviders["aws_kms.v1"]
		assert.Equal(t, "us-west-2", awsProvider["region"])
		assert.Equal(t, "test-key", awsProvider["key_id"])

		azureProvider := cfg.SecretsManagement.ConfiguredKMSProviders["azure_kv.v1"]
		assert.Equal(t, "https://test.vault.azure.net/", azureProvider["vault_url"])
	})

	t.Run("should handle configuration with no secrets_manager section", func(t *testing.T) {
		iniContent := `
[server]
domain = example.com
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, MisconfiguredProvider, cfg.SecretsManagement.CurrentEncryptionProvider)
		assert.Empty(t, cfg.SecretsManagement.ConfiguredKMSProviders)
	})

	t.Run("should handle configuration with developer mode on", func(t *testing.T) {
		iniContent := `
[secrets_manager]
developer_mode = true
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.True(t, cfg.SecretsManagement.IsDeveloperMode)
	})

	t.Run("should handle configuration without developer mode set", func(t *testing.T) {
		iniContent := `
[secrets_manager]
encryption_provider = aws_kms
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.False(t, cfg.SecretsManagement.IsDeveloperMode)
	})
}
