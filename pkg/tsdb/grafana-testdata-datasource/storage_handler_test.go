package testdatasource

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestSettingsHandler(t *testing.T) {
	svc := &Service{}

	// Check missing datasource
	s, err := svc.MutateInstanceSettings(context.Background(), &backend.InstanceSettingsAdmissionRequest{
		PluginContext: backend.PluginContext{},
	})
	require.NoError(t, err)
	require.False(t, s.Allowed)
	require.Equal(t, int32(400), s.Result.Code)

	// Empty is OK
	s, _ = svc.MutateInstanceSettings(context.Background(), &backend.InstanceSettingsAdmissionRequest{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			APIVersion: "v0alpha1",
		},
	})
	require.True(t, s.Allowed)

	// Any values should be an error
	s, err = svc.MutateInstanceSettings(context.Background(), &backend.InstanceSettingsAdmissionRequest{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: json.RawMessage(`{"hello": "world"}`), // Settings must be empty
		},
	})
	require.NoError(t, err)
	require.False(t, s.Allowed)
	require.Equal(t, int32(400), s.Result.Code)

	// Any values should be an error
	s, err = svc.MutateInstanceSettings(context.Background(), &backend.InstanceSettingsAdmissionRequest{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			DecryptedSecureJSONData: map[string]string{
				"A": "Value",
			},
		},
	})
	require.NoError(t, err)
	require.False(t, s.Allowed)
	require.Equal(t, int32(400), s.Result.Code)

	// Invalid API Version
	s, err = svc.MutateInstanceSettings(context.Background(), &backend.InstanceSettingsAdmissionRequest{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			APIVersion: "v1234",
		},
	})
	require.NoError(t, err)
	require.False(t, s.Allowed)
	require.Equal(t, int32(400), s.Result.Code)
}
