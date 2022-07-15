package alerting

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

const (
	testFileBrokenYAML               = "./testdata/common/broken-yaml"
	testFileEmptyFile                = "./testdata/common/empty-file"
	testFileEmptyFolder              = "./testdata/common/empty-folder"
	testFileSupportedFiletypes       = "./testdata/common/supported-filetypes"
	testFileCorrectProperties        = "./testdata/alert_rules/correct-properties"
	testFileCorrectPropertiesWithOrg = "./testdata/alert_rules/correct-properties-with-org"
	testFileMultipleRules            = "./testdata/alert_rules/multiple-rules"
	testFileMultipleFiles            = "./testdata/alert_rules/multiple-files"
)

func TestConfigReader(t *testing.T) {
	configReader := newRulesConfigReader(log.NewNopLogger())
	ctx := context.Background()
	t.Run("a broken YAML file should error", func(t *testing.T) {
		_, err := configReader.readConfig(ctx, testFileBrokenYAML)
		require.Error(t, err)
	})
	t.Run("a rule file with correct properties should not error", func(t *testing.T) {
		ruleFiles, err := configReader.readConfig(ctx, testFileCorrectProperties)
		require.NoError(t, err)
		t.Run("when no organization is present it should be set to 1", func(t *testing.T) {
			require.Equal(t, int64(1), ruleFiles[0].Groups[0].Rules[0].OrgID)
		})
	})
	t.Run("a rule file with correct properties and specific org should not error", func(t *testing.T) {
		ruleFiles, err := configReader.readConfig(ctx, testFileCorrectPropertiesWithOrg)
		require.NoError(t, err)
		t.Run("when an organization is set it should not overwrite if with the default of 1", func(t *testing.T) {
			require.Equal(t, int64(1337), ruleFiles[0].Groups[0].Rules[0].OrgID)
		})
	})
	t.Run("an empty rule file should not make the config reader error", func(t *testing.T) {
		_, err := configReader.readConfig(ctx, testFileEmptyFile)
		require.NoError(t, err)
	})
	t.Run("an empty folder should not make the config reader error", func(t *testing.T) {
		_, err := configReader.readConfig(ctx, testFileEmptyFolder)
		require.NoError(t, err)
	})
	t.Run("the config reader should be able to read multiple files in the folder", func(t *testing.T) {
		ruleFiles, err := configReader.readConfig(ctx, testFileMultipleFiles)
		require.NoError(t, err)
		require.Len(t, ruleFiles, 2)
	})
	t.Run("the config reader should be able to read multiple rule groups", func(t *testing.T) {
		ruleFiles, err := configReader.readConfig(ctx, testFileMultipleRules)
		require.NoError(t, err)
		require.Len(t, ruleFiles[0].Groups, 2)
	})
	t.Run("the config reader should support .yaml,.yml and .json files", func(t *testing.T) {
		ruleFiles, err := configReader.readConfig(ctx, testFileSupportedFiletypes)
		require.NoError(t, err)
		require.Len(t, ruleFiles, 3)
	})
}
