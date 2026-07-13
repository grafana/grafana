package cloudmigration

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResourceDependencyParse(t *testing.T) {
	depMap := ResourceDependency(true)

	t.Run("empty input returns an empty set", func(t *testing.T) {
		result, err := depMap.Parse(nil)
		require.NoError(t, err)
		require.Empty(t, result)
	})

	t.Run("input with duplicates returns an error", func(t *testing.T) {
		_, err := depMap.Parse([]MigrateDataType{FolderDataType, FolderDataType})
		require.ErrorIs(t, err, ErrDuplicateResourceType)
	})

	t.Run("unknown resource type returns an error", func(t *testing.T) {
		_, err := depMap.Parse([]MigrateDataType{"does not exist"})
		require.ErrorIs(t, err, ErrUnknownResourceType)
	})

	t.Run("PluginDataType has no dependencies", func(t *testing.T) {
		result, err := depMap.Parse([]MigrateDataType{PluginDataType})
		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Contains(t, result, PluginDataType)
	})

	t.Run("FolderDataType has no dependencies", func(t *testing.T) {
		result, err := depMap.Parse([]MigrateDataType{FolderDataType})
		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Contains(t, result, FolderDataType)
	})

	t.Run("DatasourceDataType requires PluginDataType", func(t *testing.T) {
		t.Run("when the dependency is missing returns an error", func(t *testing.T) {
			_, err := depMap.Parse([]MigrateDataType{DatasourceDataType})
			require.ErrorIs(t, err, ErrMissingDependency)
			require.Contains(t, err.Error(), string(PluginDataType))
		})

		t.Run("when the dependency is present returns the correct set", func(t *testing.T) {
			input := []MigrateDataType{DatasourceDataType, PluginDataType}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, 2)
		})
	})

	t.Run("LibraryElementDataType requires FolderDataType", func(t *testing.T) {
		t.Run("when the dependency is missing returns an error", func(t *testing.T) {
			_, err := depMap.Parse([]MigrateDataType{LibraryElementDataType})
			require.ErrorIs(t, err, ErrMissingDependency)
			require.Contains(t, err.Error(), string(FolderDataType))
		})

		t.Run("when the dependency is present returns the correct set", func(t *testing.T) {
			input := []MigrateDataType{LibraryElementDataType, FolderDataType}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, 2)
		})
	})

	t.Run("DashboardDataType requires multiple dependencies", func(t *testing.T) {
		t.Run("when the dependency is missing returns an error", func(t *testing.T) {
			// Missing: FolderDataType, DatasourceDataType, LibraryElementDataType, PluginDataType
			_, err := depMap.Parse([]MigrateDataType{DashboardDataType})
			require.ErrorIs(t, err, ErrMissingDependency)

			// Missing: DatasourceDataType, PluginDataType
			_, err = depMap.Parse([]MigrateDataType{
				DashboardDataType,
				LibraryElementDataType,
				FolderDataType,
			})
			require.ErrorIs(t, err, ErrMissingDependency)
		})

		t.Run("when the dependency is present returns the correct set", func(t *testing.T) {
			input := []MigrateDataType{
				DashboardDataType,
				FolderDataType,
				DatasourceDataType,
				LibraryElementDataType,
				PluginDataType,
			}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, len(input))
		})
	})

	t.Run("MuteTimingType has no dependencies", func(t *testing.T) {
		result, err := depMap.Parse([]MigrateDataType{MuteTimingType})
		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Contains(t, result, MuteTimingType)
	})

	t.Run("NotificationTemplateType has no dependencies", func(t *testing.T) {
		result, err := depMap.Parse([]MigrateDataType{NotificationTemplateType})
		require.NoError(t, err)
		require.Len(t, result, 1)
		require.Contains(t, result, NotificationTemplateType)
	})

	t.Run("ContactPointType requires NotificationTemplateType", func(t *testing.T) {
		t.Run("when the dependency is missing returns an error", func(t *testing.T) {
			_, err := depMap.Parse([]MigrateDataType{ContactPointType})
			require.ErrorIs(t, err, ErrMissingDependency)
			require.Contains(t, err.Error(), string(NotificationTemplateType))
		})

		t.Run("when the dependency is present returns the correct set", func(t *testing.T) {
			input := []MigrateDataType{ContactPointType, NotificationTemplateType}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, 2)
		})
	})

	t.Run("NotificationPolicyType requires multiple dependencies", func(t *testing.T) {
		t.Run("when the dependency is missing returns an error", func(t *testing.T) {
			// Missing: ContactPointType, NotificationTemplateType
			_, err := depMap.Parse([]MigrateDataType{NotificationPolicyType})
			require.ErrorIs(t, err, ErrMissingDependency)

			// Missing: NotificationTemplateType
			_, err = depMap.Parse([]MigrateDataType{
				NotificationPolicyType,
				ContactPointType,
			})
			require.ErrorIs(t, err, ErrMissingDependency)
		})

		t.Run("when the dependency is present returns the correct set", func(t *testing.T) {
			input := []MigrateDataType{
				NotificationPolicyType,
				ContactPointType,
				NotificationTemplateType,
				MuteTimingType,
			}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, len(input))
		})
	})

	t.Run("AlertRuleType requires multiple dependencies", func(t *testing.T) {
		t.Run("when the dependency is missing returns an error", func(t *testing.T) {
			// Missing all dependencies
			_, err := depMap.Parse([]MigrateDataType{AlertRuleType})
			require.ErrorIs(t, err, ErrMissingDependency)

			// Missing some dependencies
			_, err = depMap.Parse([]MigrateDataType{
				AlertRuleType,
				DatasourceDataType,
				FolderDataType,
			})
			require.ErrorIs(t, err, ErrMissingDependency)
		})

		t.Run("when the dependency is present returns the correct set", func(t *testing.T) {
			input := []MigrateDataType{
				AlertRuleType,
				DatasourceDataType,
				FolderDataType,
				DashboardDataType,
				MuteTimingType,
				ContactPointType,
				NotificationPolicyType,
				PluginDataType,
				LibraryElementDataType,
				NotificationTemplateType,
			}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, len(input))
		})
	})

	t.Run("AlertRuleGroupType requires AlertRuleType and all its dependencies", func(t *testing.T) {
		t.Run("when the dependency is missing returns an error", func(t *testing.T) {
			// Missing all dependencies
			_, err := depMap.Parse([]MigrateDataType{AlertRuleGroupType})
			require.ErrorIs(t, err, ErrMissingDependency)

			// With partial dependencies
			_, err = depMap.Parse([]MigrateDataType{
				AlertRuleGroupType,
				AlertRuleType,
				FolderDataType,
				DashboardDataType,
				MuteTimingType,
			})
			require.ErrorIs(t, err, ErrMissingDependency)
		})

		t.Run("when the dependency is present returns the correct set", func(t *testing.T) {
			input := []MigrateDataType{
				AlertRuleGroupType,
				AlertRuleType,
				DatasourceDataType,
				FolderDataType,
				DashboardDataType,
				MuteTimingType,
				ContactPointType,
				NotificationPolicyType,
				PluginDataType,
				LibraryElementDataType,
				NotificationTemplateType,
			}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, len(input))
		})
	})

	t.Run("multiple resources with shared dependencies", func(t *testing.T) {
		t.Run("resources with no dependencies", func(t *testing.T) {
			input := []MigrateDataType{
				FolderDataType,
				PluginDataType,
				MuteTimingType,
				NotificationTemplateType,
			}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, 4)
		})

		t.Run("overlapping dependencies", func(t *testing.T) {
			// DashboardDataType -> LibraryElementDataType -> FolderDataType
			//                  \-> DatasourceDataType     -> PluginDataType
			// ContactPointType -> NotificationTemplateType
			input := []MigrateDataType{
				DashboardDataType,
				LibraryElementDataType,
				FolderDataType,
				DatasourceDataType,
				PluginDataType,
				ContactPointType,
				NotificationTemplateType,
			}
			result, err := depMap.Parse(input)
			require.NoError(t, err)
			require.Len(t, result, 7)
		})

		t.Run("missing shared dependency fails", func(t *testing.T) {
			// ContactPointType -> NotificationTemplateType
			// DatasourceDataType -> PluginDataType
			input := []MigrateDataType{
				ContactPointType,
				DatasourceDataType,
			}
			_, err := depMap.Parse(input)
			require.ErrorIs(t, err, ErrMissingDependency)
		})
	})
}

func TestResourceDependency(t *testing.T) {
	alertingTypes := []MigrateDataType{
		MuteTimingType,
		NotificationTemplateType,
		ContactPointType,
		NotificationPolicyType,
		AlertRuleType,
		AlertRuleGroupType,
	}

	t.Run("when alerting is enabled the alerting resources are included", func(t *testing.T) {
		depMap := ResourceDependency(true)
		for _, resourceType := range alertingTypes {
			require.Contains(t, depMap, resourceType)
		}
	})

	t.Run("when alerting is disabled the alerting resources are excluded", func(t *testing.T) {
		depMap := ResourceDependency(false)
		for _, resourceType := range alertingTypes {
			require.NotContains(t, depMap, resourceType)
		}
		// Base resources are still present.
		require.Contains(t, depMap, DashboardDataType)
	})

	t.Run("when alerting is disabled selecting an alerting resource is rejected", func(t *testing.T) {
		depMap := ResourceDependency(false)
		_, err := depMap.Parse([]MigrateDataType{ContactPointType, NotificationTemplateType})
		require.ErrorIs(t, err, ErrUnknownResourceType)
	})
}
