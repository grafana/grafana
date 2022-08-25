package kvstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Set fatal flag to true, then simulate a plugin start failure
// Should result in an error from the secret store provider
func TestFatalPluginErr_PluginFailsToStartWithFatalFlagSet(t *testing.T) {
	p, err := SetupFatalCrashTest(t, true, true, false)
	assert.Error(t, err)
	assert.Equal(t, "mocked failed to start", err.Error())
	assert.Nil(t, p.SecretsKVStore)
}

// Set fatal flag to false, then simulate a plugin start failure
// Should result in the secret store provider returning the sql impl
func TestFatalPluginErr_PluginFailsToStartWithFatalFlagNotSet(t *testing.T) {
	p, err := SetupFatalCrashTest(t, true, false, false)
	assert.NoError(t, err)
	require.IsType(t, &CachedKVStore{}, p.SecretsKVStore)

	cachedKv, _ := p.SecretsKVStore.(*CachedKVStore)
	assert.IsType(t, &SecretsKVStoreSQL{}, cachedKv.GetUnwrappedStore())
}

// With fatal flag not set, store a secret in the plugin while backwards compatibility is disabled
// Should result in the fatal flag going from unset -> set to true
func TestFatalPluginErr_FatalFlagGetsSetWithBackwardsCompatDisabled(t *testing.T) {
	p, err := SetupFatalCrashTest(t, false, false, true)
	assert.NoError(t, err)
	require.NotNil(t, p.SecretsKVStore)

	err = p.SecretsKVStore.Set(context.Background(), 0, "datasource", "postgres", "my secret")
	assert.NoError(t, err)

	isFatal, err := IsPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(p.KVStore))
	assert.NoError(t, err)
	assert.True(t, isFatal)
}

// With fatal flag set, retrieve a secret from the plugin while backwards compatibility is enabled
// Should result in the fatal flag going from set to true -> unset
func TestFatalPluginErr_FatalFlagGetsUnSetWithBackwardsCompatEnabled(t *testing.T) {
	p, err := SetupFatalCrashTest(t, false, true, false)
	assert.NoError(t, err)
	require.NotNil(t, p.SecretsKVStore)

	// setup - store secret and manually bypassing the remote plugin impl
	_, err = p.PluginManager.SecretsManager().SecretsManager.SetSecret(context.Background(), &secretsmanagerplugin.SetSecretRequest{
		KeyDescriptor: &secretsmanagerplugin.Key{
			OrgId:     0,
			Namespace: "postgres",
			Type:      "datasource",
		},
		Value: "bogus",
	})
	assert.NoError(t, err)

	// retrieve the secret and check values
	val, exists, err := p.SecretsKVStore.Get(context.Background(), 0, "postgres", "datasource")
	assert.NoError(t, err)
	assert.NotNil(t, val)
	assert.True(t, exists)

	isFatal, err := IsPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(p.KVStore))
	assert.NoError(t, err)
	assert.False(t, isFatal)
}
