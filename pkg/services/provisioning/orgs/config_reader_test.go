package orgs

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	incorrectSettings = "./testdata/test-configs/incorrect-settings"
	brokenYaml        = "./testdata/test-configs/broken-yaml"
	emptyFolder       = "./testdata/test-configs/empty-folder"
	correctProperties = "./testdata/test-configs/correct-properties"
)

func TestConfigReader(t *testing.T) {
	t.Run("Broken yaml should return error", func(t *testing.T) {
		reader := newConfigReader(log.New("test logger"))
		_, err := reader.readConfig(context.Background(), brokenYaml)
		require.Error(t, err)
	})

	t.Run("Skip invalid directory", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"))
		cfg, err := cfgProvider.readConfig(context.Background(), emptyFolder)
		require.NoError(t, err)
		require.Len(t, cfg, 0)
	})

	t.Run("Read incorrect properties", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"))
		_, err := cfgProvider.readConfig(context.Background(), incorrectSettings)
		require.Error(t, err)
		require.Equal(t, "org item 1 in configuration doesn't contain required field name", err.Error())
	})

	t.Run("Can read correct properties", func(t *testing.T) {
		cfgProvider := newConfigReader(log.New("test logger"))
		cfg, err := cfgProvider.readConfig(context.Background(), correctProperties)
		require.NoError(t, err)
		require.Len(t, cfg, 1)

		testCases := []struct {
			ExpecteName string
		}{
			{ExpecteName: "My org"},
			{ExpecteName: "My org 2"},
		}

		for index, tc := range testCases {
			o := cfg[0].Orgs[index]
			require.NotNil(t, o)
			require.Equal(t, tc.ExpecteName, o.Name)
		}
	})
}
