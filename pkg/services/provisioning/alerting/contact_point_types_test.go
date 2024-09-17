package alerting

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

func TestReceivers(t *testing.T) {
	t.Run("Valid config should not error on mapping", func(t *testing.T) {
		cp := validReceiverV1(t)
		_, err := cp.mapToModel("test")
		require.NoError(t, err)
	})
	t.Run("Invalid config should error on mapping", func(t *testing.T) {
		cp := validReceiverV1(t)
		var settings values.JSONValue
		err := yaml.Unmarshal([]byte(`{"not-valid": "http://test-url"}`), &settings)
		require.NoError(t, err)
		cp.Settings = settings
		_, err = cp.mapToModel("test")
		require.Error(t, err)
	})
	t.Run("Empty config should error on mapping", func(t *testing.T) {
		cp := validReceiverV1(t)
		var settings values.JSONValue
		err := yaml.Unmarshal([]byte(`{}`), &settings)
		require.NoError(t, err)
		cp.Settings = settings
		_, err = cp.mapToModel("test")
		require.Error(t, err)
	})
	t.Run("Missing UID should error on mapping", func(t *testing.T) {
		cp := validReceiverV1(t)
		var uid values.StringValue
		err := yaml.Unmarshal([]byte(""), &uid)
		require.NoError(t, err)
		cp.UID = uid
		_, err = cp.mapToModel("test")
		require.Error(t, err)
	})
	t.Run("Missing type should error on mapping", func(t *testing.T) {
		cp := validReceiverV1(t)
		var _type values.StringValue
		err := yaml.Unmarshal([]byte(""), &_type)
		require.NoError(t, err)
		cp.Type = _type
		_, err = cp.mapToModel("test")
		require.Error(t, err)
	})
	t.Run("Ivalid type should error on mapping", func(t *testing.T) {
		cp := validReceiverV1(t)
		var _type values.StringValue
		err := yaml.Unmarshal([]byte("some-type-that-does-not-exist"), &_type)
		require.NoError(t, err)
		cp.Type = _type
		_, err = cp.mapToModel("test")
		require.Error(t, err)
	})
}

func validReceiverV1(t *testing.T) ReceiverV1 {
	t.Helper()
	var (
		uid                   values.StringValue
		_type                 values.StringValue
		settings              values.JSONValue
		disableResolveMessage values.BoolValue
	)
	err := yaml.Unmarshal([]byte("my_uid"), &uid)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte("prometheus-alertmanager"), &_type)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte(`{"url": "http://test-url"}`), &settings)
	require.NoError(t, err)
	err = yaml.Unmarshal([]byte("false"), &disableResolveMessage)
	require.NoError(t, err)
	return ReceiverV1{
		UID:                   uid,
		Type:                  _type,
		Settings:              settings,
		DisableResolveMessage: disableResolveMessage,
	}
}
