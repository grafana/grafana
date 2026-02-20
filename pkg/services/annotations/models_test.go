package annotations

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestItemDTOJSONSerialization(t *testing.T) {
	t.Run("alertId field should be present even when zero", func(t *testing.T) {
		// Manual annotation with alertId = 0
		annotation := &ItemDTO{
			ID:      1,
			AlertID: 0, // This should still appear in JSON
			Text:    "Manual annotation",
			Time:    1234567890000,
		}

		jsonBytes, err := json.Marshal(annotation)
		require.NoError(t, err)

		var result map[string]interface{}
		err = json.Unmarshal(jsonBytes, &result)
		require.NoError(t, err)

		// Verify alertId field exists in JSON
		_, exists := result["alertId"]
		assert.True(t, exists, "alertId field should be present in JSON even when value is 0")
		assert.Equal(t, float64(0), result["alertId"], "alertId should be 0")
	})

	t.Run("alertId field should be present with non-zero value", func(t *testing.T) {
		// Alert annotation with alertId > 0
		annotation := &ItemDTO{
			ID:      1,
			AlertID: 123,
			Text:    "Alert annotation",
			Time:    1234567890000,
		}

		jsonBytes, err := json.Marshal(annotation)
		require.NoError(t, err)

		var result map[string]interface{}
		err = json.Unmarshal(jsonBytes, &result)
		require.NoError(t, err)

		_, exists := result["alertId"]
		assert.True(t, exists, "alertId field should be present in JSON")
		assert.Equal(t, float64(123), result["alertId"], "alertId should be 123")
	})
}

func TestItemDTOGetType(t *testing.T) {
	t.Run("should return Dashboard type when DashboardUID is set", func(t *testing.T) {
		dashUID := "test-dash-uid"
		annotation := &ItemDTO{
			DashboardUID: &dashUID,
		}

		annotationType := annotation.GetType()
		assert.Equal(t, Dashboard, annotationType)
	})

	t.Run("should return Organization type when DashboardUID is nil", func(t *testing.T) {
		annotation := &ItemDTO{
			DashboardUID: nil,
		}

		annotationType := annotation.GetType()
		assert.Equal(t, Organization, annotationType)
	})

	t.Run("should return Organization type when DashboardUID is empty string", func(t *testing.T) {
		emptyUID := ""
		annotation := &ItemDTO{
			DashboardUID: &emptyUID,
		}

		annotationType := annotation.GetType()
		assert.Equal(t, Organization, annotationType)
	})
}
