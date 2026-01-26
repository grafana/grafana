package legacy_storage

import (
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestConfigRevisionImported(t *testing.T) {
	t.Run("should return error if extra config is invalid", func(t *testing.T) {
		rev := getConfigRevisionForTest(withExtraConfig(extraConfig("invalid")))
		_, err := rev.Imported()
		require.Error(t, err)
	})

	t.Run("should return imported config if extra config is valid even if it cannot be fully merged", func(t *testing.T) {
		rev := getConfigRevisionForTest(withExtraConfigAndConflictingMatchers())
		imported, err := rev.Imported()
		require.NoError(t, err)
		require.NotNil(t, imported)
	})
	t.Run("should return imported config if extra config is valid", func(t *testing.T) {
		rev := getConfigRevisionForTest(withExtraConfig(extraConfig(extraConfigurationYaml)))

		imported, err := rev.Imported()
		require.NoError(t, err)
		require.NotNil(t, imported)
	})
}

func TestConfigRevisionImported_GetReceivers(t *testing.T) {
	rev := getConfigRevisionForTest(withExtraConfig(extraConfig(extraConfigurationYaml)))
	imported, err := rev.Imported()
	require.NoError(t, err)

	t.Run("should return all receivers available in imported config", func(t *testing.T) {
		receivers, err := imported.GetReceivers(nil)
		require.NoError(t, err)
		require.Len(t, receivers, 2)
		assert.Equal(t, "imported-receiver-1", receivers[0].Name)
		assert.Equal(t, NameToUid("imported-receiver-1"), receivers[0].UID)
		assert.Equal(t, models.ProvenanceConvertedPrometheus, receivers[0].Provenance)
		assert.Equal(t, models.ResourceOriginImported, receivers[0].Origin)
		assert.Len(t, receivers[0].Integrations, 1)

		assert.Equal(t, "imported-receiver-2", receivers[1].Name)
		assert.Equal(t, NameToUid("imported-receiver-2"), receivers[1].UID)
		assert.Equal(t, models.ProvenanceConvertedPrometheus, receivers[1].Provenance)
		assert.Equal(t, models.ResourceOriginImported, receivers[1].Origin)
		assert.Len(t, receivers[1].Integrations, 1)
	})
	t.Run("should filter receivers in imported config", func(t *testing.T) {
		receivers, err := imported.GetReceivers([]string{models.NameToUid("imported-receiver-2")})
		require.NoError(t, err)
		require.Len(t, receivers, 1)
		assert.Equal(t, "imported-receiver-2", receivers[0].Name)
		assert.Equal(t, NameToUid("imported-receiver-2"), receivers[0].UID)

		receivers, err = imported.GetReceivers([]string{models.NameToUid("not-found")})
		require.NoError(t, err)
		assert.Empty(t, receivers)
	})

	t.Run("should be correctly named in case of renames", func(t *testing.T) {
		const dupeConfig = `
route:
  receiver: receiver1
receivers:
  - name: receiver1
  - name: dupe-receiver
`
		extra := extraConfig(dupeConfig)
		expectedDedupSuffix := extra.Identifier
		rev := getConfigRevisionForTest(withExtraConfig(extra))
		imported, err = rev.Imported()
		require.NoError(t, err)

		result, err := imported.GetReceivers(nil)
		require.NoError(t, err)
		require.Len(t, result, 2)
		assert.Equal(t, "receiver1"+expectedDedupSuffix, result[0].Name)
		assert.Equal(t, models.NameToUid("receiver1"+expectedDedupSuffix), result[0].UID)
		assert.Equal(t, "dupe-receiver"+expectedDedupSuffix, result[1].Name)
		assert.Equal(t, models.NameToUid("dupe-receiver"+expectedDedupSuffix), result[1].UID)

		t.Run("should search by renamed uid", func(t *testing.T) {
			result, err = imported.GetReceivers([]string{NameToUid("receiver1")})
			require.NoError(t, err)
			require.Empty(t, result)

			result, err = imported.GetReceivers([]string{NameToUid("receiver1" + expectedDedupSuffix)})
			require.NoError(t, err)
			require.Len(t, result, 1)
		})
	})

	t.Run("should return empty list if no imported configuration", func(t *testing.T) {
		rev := getConfigRevisionForTest()
		imported, err = rev.Imported()
		require.NoError(t, err)
		assert.Nil(t, imported.importedConfig)

		result, err := imported.GetReceivers(nil)
		require.NoError(t, err)
		require.Empty(t, result)
	})
}

func TestConfigRevisionImported_ReceiverUseByName(t *testing.T) {
	t.Run("should be empty if no configuration", func(t *testing.T) {
		rev := getConfigRevisionForTest()
		imported, err := rev.Imported()
		require.NoError(t, err)
		require.Empty(t, imported.ReceiverUseByName())
	})
	t.Run("should count usages of the receivers", func(t *testing.T) {
		const cfg = `
route:
  receiver: r1
  routes:
  - receiver: r2
    routes:
    - receiver: r1
  - routes:
    - receiver: r2
receivers:
- name: r1
- name: r2
`
		extra := extraConfig(cfg)
		rev := getConfigRevisionForTest(withExtraConfig(extra))

		imported, err := rev.Imported()
		require.NoError(t, err)
		actual := imported.ReceiverUseByName()
		require.EqualValues(t, map[string]int{
			"":   1,
			"r1": 2,
			"r2": 2,
		}, actual)
	})

	t.Run("should correctly handle deduplicated names", func(t *testing.T) {
		const dupeConfig = `
route:
  receiver: receiver1
  routes: 
    - receiver: dupe-receiver
    - receiver: r1
receivers:
  - name: receiver1
  - name: dupe-receiver
  - name: r1
`
		extra := extraConfig(dupeConfig)
		expectedDedupSuffix := extra.Identifier
		rev := getConfigRevisionForTest(withExtraConfig(extra))

		imported, err := rev.Imported()
		require.NoError(t, err)
		actual := imported.ReceiverUseByName()
		require.EqualValues(t, map[string]int{
			"receiver1" + expectedDedupSuffix:     1,
			"dupe-receiver" + expectedDedupSuffix: 1,
			"r1":                                  1,
		}, actual)
	})
}

func extraConfig(yamlString string) definitions.ExtraConfiguration {
	return definitions.ExtraConfiguration{
		Identifier: "test",
		MergeMatchers: config.Matchers{
			&labels.Matcher{Type: labels.MatchEqual, Name: "__imported", Value: "test"},
		},
		AlertmanagerConfig: yamlString,
	}
}

func withExtraConfig(extra definitions.ExtraConfiguration) opt {
	return func(rev *ConfigRevision) {
		rev.Config.ExtraConfigs = []definitions.ExtraConfiguration{
			extra,
		}
	}
}

func withExtraConfigAndConflictingMatchers() opt {
	return func(rev *ConfigRevision) {
		matcher := &labels.Matcher{Type: labels.MatchEqual, Name: "__imported", Value: "test"}
		rev.Config.AlertmanagerConfig.Route.Routes = append(rev.Config.AlertmanagerConfig.Route.Routes, &definitions.Route{
			Matchers: []*labels.Matcher{matcher},
		})
		rev.Config.ExtraConfigs = []definitions.ExtraConfiguration{
			{
				Identifier: "test",
				MergeMatchers: config.Matchers{
					matcher,
				},
				TemplateFiles:      nil,
				AlertmanagerConfig: extraConfigurationYaml,
			},
		}
	}
}

const extraConfigurationYaml = `
route:
  receiver: imported-receiver-1
receivers:
  - name: imported-receiver-1
    webhook_configs:
      - url: "http://localhost/"
  - name: imported-receiver-2
    webhook_configs:
      - url: "http://localhost/"
`
