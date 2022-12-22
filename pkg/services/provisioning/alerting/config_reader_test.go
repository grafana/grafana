package alerting

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

const (
	testFileBrokenYAML                  = "./testdata/common/broken-yaml"
	testFileEmptyFile                   = "./testdata/common/empty-file"
	testFileEmptyFolder                 = "./testdata/common/empty-folder"
	testFileSupportedFiletypes          = "./testdata/common/supported-filetypes"
	testFileCorrectProperties           = "./testdata/alert_rules/correct-properties"
	testFileCorrectPropertiesWithOrg    = "./testdata/alert_rules/correct-properties-with-org"
	testFileMultipleRules               = "./testdata/alert_rules/multiple-rules"
	testFileMultipleFiles               = "./testdata/alert_rules/multiple-files"
	testFileCorrectProperties_cp        = "./testdata/contact_points/correct-properties"
	testFileCorrectPropertiesWithOrg_cp = "./testdata/contact_points/correct-properties-with-org"
	testFileEmptyUID                    = "./testdata/contact_points/empty-uid"
	testFileMissingUID                  = "./testdata/contact_points/missing-uid"
	testFileWhitespaceUID               = "./testdata/contact_points/whitespace-uid"
	testFileMultipleCps                 = "./testdata/contact_points/multiple-contact-points"
	testFileCorrectProperties_np        = "./testdata/notificiation_policies/correct-properties"
	testFileCorrectPropertiesWithOrg_np = "./testdata/notificiation_policies/correct-properties-with-org"
	testFileMultipleNps                 = "./testdata/notificiation_policies/multiple-policies"
	testFileCorrectProperties_mt        = "./testdata/mute_times/correct-properties"
	testFileCorrectPropertiesWithOrg_mt = "./testdata/mute_times/correct-properties-with-org"
	testFileMultipleMts                 = "./testdata/mute_times/multiple-mute-times"
	testFileCorrectProperties_t         = "./testdata/templates/correct-properties"
	testFileCorrectPropertiesWithOrg_t  = "./testdata/templates/correct-properties-with-org"
	testFileMultipleTs                  = "./testdata/templates/multiple-templates"
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
	t.Run("a contact point file with correct properties should not error", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileCorrectProperties_cp)
		require.NoError(t, err)
		t.Run("when no organization is present it should be set to 1", func(t *testing.T) {
			require.Equal(t, int64(1), file[0].ContactPoints[0].OrgID)
		})
	})
	t.Run("a contact point file with correct properties and specific org should not error", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileCorrectPropertiesWithOrg_cp)
		require.NoError(t, err)
		t.Run("when an organization is set it should not overwrite if with the default of 1", func(t *testing.T) {
			require.Equal(t, int64(1337), file[0].ContactPoints[0].OrgID)
		})
	})
	t.Run("a contact point file with empty UID should fail", func(t *testing.T) {
		_, err := configReader.readConfig(ctx, testFileEmptyUID)
		require.Error(t, err)
	})
	t.Run("a contact point file with missing UID should fail", func(t *testing.T) {
		_, err := configReader.readConfig(ctx, testFileMissingUID)
		require.Error(t, err)
	})
	t.Run("a contact point file with whitespace UID should fail", func(t *testing.T) {
		_, err := configReader.readConfig(ctx, testFileWhitespaceUID)
		require.Error(t, err)
	})
	t.Run("the config reader should be able to read a file with multiple contact points", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileMultipleCps)
		require.NoError(t, err)
		require.Len(t, file[0].ContactPoints, 2)
	})
	t.Run("a notification policy file with correct properties and specific org should not error", func(t *testing.T) {
		_, err := configReader.readConfig(ctx, testFileCorrectProperties_np)
		require.NoError(t, err)
	})
	t.Run("a notification policy file with correct properties and specific org should not error", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileCorrectPropertiesWithOrg_np)
		require.NoError(t, err)
		t.Run("when an organization is set it should not overwrite it with the default of 1", func(t *testing.T) {
			require.Equal(t, int64(1337), file[0].Policies[0].OrgID)
		})
	})
	t.Run("the config reader should be able to read a file with multiple notification policies", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileMultipleNps)
		require.NoError(t, err)
		require.Len(t, file[0].Policies, 2)
	})
	t.Run("a mute times file with correct properties and specific org should not error", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileCorrectProperties_mt)
		require.NoError(t, err)
		require.Equal(t, "test", file[0].MuteTimes[0].MuteTime.Name)
	})
	t.Run("a mute times file with correct properties and specific org should not error", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileCorrectPropertiesWithOrg_mt)
		require.NoError(t, err)
		t.Run("when an organization is set it should not overwrite it with the default of 1", func(t *testing.T) {
			require.Equal(t, int64(1337), file[0].MuteTimes[0].OrgID)
		})
	})
	t.Run("the config reader should be able to read a file with multiple mute times", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileMultipleMts)
		require.NoError(t, err)
		require.Len(t, file[0].MuteTimes, 2)
	})
	t.Run("a template file with correct properties and specific org should not error", func(t *testing.T) {
		_, err := configReader.readConfig(ctx, testFileCorrectProperties_t)
		require.NoError(t, err)
	})
	t.Run("a template file with correct properties and specific org should not error", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileCorrectPropertiesWithOrg_t)
		require.NoError(t, err)
		t.Run("when an organization is set it should not overwrite it with the default of 1", func(t *testing.T) {
			require.Equal(t, int64(1337), file[0].Templates[0].OrgID)
		})
	})
	t.Run("the config reader should be able to read a file with multiple mute times", func(t *testing.T) {
		file, err := configReader.readConfig(ctx, testFileMultipleTs)
		require.NoError(t, err)
		require.Len(t, file[0].Templates, 2)
	})
}
