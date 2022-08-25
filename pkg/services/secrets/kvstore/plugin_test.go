package kvstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
	"github.com/stretchr/testify/require"
)

// Set fatal flag to true, then simulate a plugin start failure
// Should result in an error from the secret store provider
func TestFatalPluginErr_PluginFailsToStartWithFatalFlagSet(t *testing.T) {
	svc, mgr, _, _, err := SetupFatalCrashTest(t, true, true, false)
	_ = fmt.Sprint(mgr) // this is here to satisfy the linter
	require.Error(t, err)
	require.Nil(t, svc)
}

// Set fatal flag to false, then simulate a plugin start failure
// Should result in the secret store provider returning the sql impl
func TestFatalPluginErr_PluginFailsToStartWithFatalFlagNotSet(t *testing.T) {
	svc, mgr, _, _, err := SetupFatalCrashTest(t, true, false, false)
	_ = fmt.Sprint(mgr) // this is here to satisfy the linter
	require.NoError(t, err)
	require.IsType(t, &CachedKVStore{}, svc)
	cachedKv, _ := svc.(*CachedKVStore)
	require.IsType(t, &SecretsKVStoreSQL{}, cachedKv.GetUnwrappedStore())
}

// With fatal flag not set, store a secret in the plugin while backwards compatibility is disabled
// Should result in the fatal flag going from unset -> set to true
func TestFatalPluginErr_FatalFlagGetsSetWithBackwardsCompatDisabled(t *testing.T) {
	svc, _, kvstore, _, err := SetupFatalCrashTest(t, false, false, true)
	require.NoError(t, err)
	require.NotNil(t, svc)
	err = svc.Set(context.Background(), 0, "datasource", "postgres", "my secret")
	require.NoError(t, err)
	isFatal, err := IsPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(kvstore))
	require.NoError(t, err)
	require.True(t, isFatal)
}

// With fatal flag set, retrieve a secret from the plugin while backwards compatibility is enabled
// Should result in the fatal flag going from set to true -> unset
func TestFatalPluginErr_FatalFlagGetsUnSetWithBackwardsCompatEnabled(t *testing.T) {
	svc, mgr, kvstore, _, err := SetupFatalCrashTest(t, false, true, false)
	require.NoError(t, err)
	require.NotNil(t, svc)
	// setup - store secret and manually bypassing the remote plugin impl
	_, err = mgr.SecretsManager().SecretsManager.SetSecret(context.Background(), &secretsmanagerplugin.SetSecretRequest{
		KeyDescriptor: &secretsmanagerplugin.Key{
			OrgId:     0,
			Namespace: "postgres",
			Type:      "datasource",
		},
		Value: "bogus",
	})
	require.NoError(t, err)
	// retrieve the secret and check values
	val, exists, err := svc.Get(context.Background(), 0, "postgres", "datasource")
	require.NoError(t, err)
	require.NotNil(t, val)
	require.True(t, exists)
	isFatal, err := IsPluginStartupErrorFatal(context.Background(), GetNamespacedKVStore(kvstore))
	require.NoError(t, err)
	require.False(t, isFatal)
}
