package authchecks

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests" // Correct import path for the mock
	"github.com/stretchr/testify/require"
)

func TestCheck_ID(t *testing.T) {
	mockService := ssosettingstests.NewMockService(t)
	c := New(mockService)
	require.Equal(t, CheckID, c.ID())
}

func TestCheck_Items(t *testing.T) {
	ctx := context.Background()

	t.Run("Success", func(t *testing.T) {
		mockService := ssosettingstests.NewMockService(t)
		expectedSettings := []*models.SSOSettings{
			{Provider: "google", Settings: map[string]any{"client_id": "id1"}},
			{Provider: "github", Settings: map[string]any{"client_id": "id2"}},
		}
		mockService.On("ListWithRedactedSecrets", ctx).Return(expectedSettings, nil)

		c := New(mockService)
		items, err := c.Items(ctx)

		require.NoError(t, err)
		require.Len(t, items, len(expectedSettings))

		actualSettings := make([]*models.SSOSettings, len(items))
		for i, item := range items {
			setting, ok := item.(*models.SSOSettings)
			require.True(t, ok, "Item should be of type *models.SSOSettings")
			actualSettings[i] = setting
		}
		require.Equal(t, expectedSettings, actualSettings)
	})

	t.Run("Error from service", func(t *testing.T) {
		mockService := ssosettingstests.NewMockService(t)
		expectedErr := errors.New("database error")
		mockService.On("ListWithRedactedSecrets", ctx).Return(nil, expectedErr)

		c := New(mockService)
		items, err := c.Items(ctx)

		require.Error(t, err)
		require.Nil(t, items)
		require.ErrorContains(t, err, "failed to list SSO settings")
		require.ErrorIs(t, err, expectedErr)
	})
}

func TestCheck_Item(t *testing.T) {
	ctx := context.Background()
	providerID := "google"

	t.Run("Success", func(t *testing.T) {
		mockService := ssosettingstests.NewMockService(t)
		expectedSetting := &models.SSOSettings{
			Provider: providerID,
			Settings: map[string]any{"client_id": "id1"},
		}
		mockService.On("GetForProviderWithRedactedSecrets", ctx, providerID).Return(expectedSetting, nil)

		c := New(mockService)
		item, err := c.Item(ctx, providerID)

		require.NoError(t, err)
		require.NotNil(t, item)
		actualSetting, ok := item.(*models.SSOSettings)
		require.True(t, ok, "Item should be of type *models.SSOSettings")
		require.Equal(t, expectedSetting, actualSetting)
	})

	t.Run("Error from service", func(t *testing.T) {
		mockService := ssosettingstests.NewMockService(t)
		expectedErr := errors.New("not found")
		mockService.On("GetForProviderWithRedactedSecrets", ctx, providerID).Return(nil, expectedErr)

		c := New(mockService)
		item, err := c.Item(ctx, providerID)

		require.Error(t, err)
		require.Nil(t, item)
		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("should return nil when sso settings are not found", func(t *testing.T) {
		mockService := ssosettingstests.NewMockService(t)
		mockService.On("GetForProviderWithRedactedSecrets", ctx, providerID).Return(nil, ssosettings.ErrNotFound)

		c := New(mockService)
		item, err := c.Item(ctx, providerID)
		require.NoError(t, err)
		require.Nil(t, item)
	})
}
