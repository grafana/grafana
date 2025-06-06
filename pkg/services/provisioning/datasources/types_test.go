package datasources

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUIDFromNames(t *testing.T) {
	t.Run("generate safe uid from name", func(t *testing.T) {
		require.Equal(t, safeUIDFromName("Hello world"), "P64EC88CA00B268E5")
		require.Equal(t, safeUIDFromName("Hello World"), "PA591A6D40BF42040")
		require.Equal(t, safeUIDFromName("AAA"), "PCB1AD2119D8FAFB6")
	})
}

func TestCreateUpdateCommand(t *testing.T) {
	t.Run("includes the version in the command", func(t *testing.T) {
		ds := &upsertDataSourceFromConfig{OrgID: 1, Version: 1, Name: "test"}
		cmd := createUpdateCommand(ds, 1)
		require.Equal(t, 1, cmd.Version)
	})

	t.Run("includes description in the command", func(t *testing.T) {
		description := "Test datasource description"
		ds := &upsertDataSourceFromConfig{
			OrgID:       1,
			Name:        "test",
			Description: description,
			Type:        "prometheus",
			Access:      "proxy",
		}
		cmd := createUpdateCommand(ds, 1)
		require.Equal(t, description, cmd.Description)
		require.Equal(t, "test", cmd.Name)
	})

	t.Run("handles empty description", func(t *testing.T) {
		ds := &upsertDataSourceFromConfig{
			OrgID:       1,
			Name:        "test",
			Description: "",
			Type:        "prometheus",
			Access:      "proxy",
		}
		cmd := createUpdateCommand(ds, 1)
		require.Equal(t, "", cmd.Description)
	})

	t.Run("handles missing description field", func(t *testing.T) {
		ds := &upsertDataSourceFromConfig{
			OrgID:  1,
			Name:   "test",
			Type:   "prometheus",
			Access: "proxy",
			// Description intentionally omitted
		}
		cmd := createUpdateCommand(ds, 1)
		require.Equal(t, "", cmd.Description) // Should default to empty string
	})
}

func TestCreateInsertCommand(t *testing.T) {
	t.Run("includes description in the command", func(t *testing.T) {
		description := "Test datasource description for insert"
		ds := &upsertDataSourceFromConfig{
			OrgID:       1,
			Name:        "test-insert",
			Description: description,
			Type:        "prometheus",
			Access:      "proxy",
			URL:         "http://localhost:9090",
		}
		cmd := createInsertCommand(ds)
		require.Equal(t, description, cmd.Description)
		require.Equal(t, "test-insert", cmd.Name)
		require.Equal(t, "prometheus", cmd.Type)
	})

	t.Run("handles empty description in insert", func(t *testing.T) {
		ds := &upsertDataSourceFromConfig{
			OrgID:       1,
			Name:        "test-empty",
			Description: "",
			Type:        "prometheus",
			Access:      "proxy",
		}
		cmd := createInsertCommand(ds)
		require.Equal(t, "", cmd.Description)
	})

	t.Run("generates UID when not provided", func(t *testing.T) {
		ds := &upsertDataSourceFromConfig{
			OrgID:       1,
			Name:        "test-uid-generation",
			Description: "Test with UID generation",
			Type:        "prometheus",
			Access:      "proxy",
		}
		cmd := createInsertCommand(ds)
		require.NotEmpty(t, cmd.UID)
		require.Equal(t, safeUIDFromName("test-uid-generation"), cmd.UID)
		require.Equal(t, "Test with UID generation", cmd.Description)
	})
}

func TestConfigMapping(t *testing.T) {
	t.Run("configsV0 maps description correctly", func(t *testing.T) {
		configV0 := &configsV0{
			Datasources: []*upsertDataSourceFromConfigV0{
				{
					OrgID:       1,
					Name:        "test-v0",
					Description: "V0 test description",
					Type:        "prometheus",
					Access:      "proxy",
					URL:         "http://localhost:9090",
				},
			},
		}

		mapped := configV0.mapToDatasourceFromConfig(0)
		require.Equal(t, 1, len(mapped.Datasources))
		require.Equal(t, "V0 test description", mapped.Datasources[0].Description)
		require.Equal(t, "test-v0", mapped.Datasources[0].Name)
	})

	t.Run("handles empty description in V0", func(t *testing.T) {
		// Test V0 with empty description
		configV0 := &configsV0{
			Datasources: []*upsertDataSourceFromConfigV0{
				{
					OrgID:       1,
					Name:        "test-empty-v0",
					Description: "",
					Type:        "prometheus",
					Access:      "proxy",
				},
			},
		}
		mappedV0 := configV0.mapToDatasourceFromConfig(0)
		require.Equal(t, "", mappedV0.Datasources[0].Description)
	})
}
