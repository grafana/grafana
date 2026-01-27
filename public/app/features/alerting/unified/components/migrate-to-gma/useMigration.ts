import { useCallback } from 'react';

import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { fetchAlertManagerConfig } from '../../api/alertmanager';
import { convertToGMAApi } from '../../api/convertToGMAApi';

interface MigrateNotificationsParams {
  source: 'datasource' | 'yaml';
  /** Datasource name (not UID) - required when source is 'datasource' */
  datasourceName?: string;
  yamlFile: File | null;
  mergeMatchers: string; // e.g., "importedLabel=my-policy" (label name should match DEFAULT_MIGRATION_LABEL_NAME)
}

interface MigrateRulesParams {
  dataSourceUID: string;
  targetFolderUID?: string;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  payload: RulerRulesConfigDTO;
  targetDatasourceUID?: string;
  /** Extra labels to add to all imported rules (format: key=value,key2=value2) */
  extraLabels?: string;
}

/**
 * Hook to migrate notification resources (contact points, policies, templates, time intervals)
 * Uses the /api/convert/api/v1/alerts endpoint via RTK Query
 */
export function useMigrateNotifications() {
  const [convertAlertmanagerConfig] = convertToGMAApi.useConvertAlertmanagerConfigMutation();

  return useCallback(
    async (params: MigrateNotificationsParams) => {
      const { source, datasourceName, yamlFile, mergeMatchers } = params;

      let alertmanagerConfig: string;
      let templateFiles: Record<string, string> = {};

      if (source === 'yaml' && yamlFile) {
        // For YAML files, we expect the full alertmanager_config format
        alertmanagerConfig = await yamlFile.text();
      } else if (source === 'datasource' && datasourceName) {
        // Fetch the Alertmanager config from the datasource
        const config = await fetchAlertManagerConfig(datasourceName);
        // Serialize the config to JSON string (backend accepts JSON or YAML)
        alertmanagerConfig = JSON.stringify(config.alertmanager_config);
        templateFiles = config.template_files ?? {};
      } else {
        throw new Error('Invalid migration source configuration');
      }

      // Call the convert API for notifications using RTK Query
      await convertAlertmanagerConfig({
        alertmanagerConfig,
        templateFiles,
        mergeMatchers,
      }).unwrap();
    },
    [convertAlertmanagerConfig]
  );
}

/**
 * Hook to migrate alert rules and recording rules
 * Uses the convertToGMAApi (same as ImportToGMARules)
 */
export function useMigrateRules() {
  const [convert] = convertToGMAApi.useConvertToGMAMutation();

  return useCallback(
    async (params: MigrateRulesParams) => {
      const {
        dataSourceUID,
        targetFolderUID,
        pauseAlertingRules,
        pauseRecordingRules,
        payload,
        targetDatasourceUID,
        extraLabels,
      } = params;

      await convert({
        dataSourceUID,
        targetFolderUID,
        pauseRecordingRules,
        pauseAlerts: pauseAlertingRules,
        payload,
        targetDatasourceUID,
        extraLabels,
      }).unwrap();
    },
    [convert]
  );
}

/**
 * Filter rules by namespace and group, excluding rules managed by external systems
 */
export function filterRulerRulesConfig(
  rulerRulesConfig: RulerRulesConfigDTO,
  namespace?: string,
  groupName?: string
): { filteredConfig: RulerRulesConfigDTO; someRulesAreSkipped: boolean } {
  const filteredConfig: RulerRulesConfigDTO = {};
  let someRulesAreSkipped = false;

  Object.entries(rulerRulesConfig).forEach(([ns, groups]) => {
    if (namespace && ns !== namespace) {
      return;
    }

    const filteredGroups = groups
      .filter((group) => {
        if (groupName && group.name !== groupName) {
          return false;
        }
        return true;
      })
      .map((group) => {
        const filteredRules = group.rules.filter((rule) => {
          const shouldSkip = isRuleManagedByExternalSystem(rule);
          if (shouldSkip) {
            someRulesAreSkipped = true;
            return false;
          }
          return true;
        });

        return {
          ...group,
          rules: filteredRules,
        };
      })
      .filter((group) => group.rules.length > 0);

    if (filteredGroups.length > 0) {
      filteredConfig[ns] = filteredGroups;
    }
  });

  return { filteredConfig, someRulesAreSkipped };
}

/**
 * Check if a rule is managed by an external system (plugins, integrations, synthetics)
 */
function isRuleManagedByExternalSystem(rule: { labels?: Record<string, string> }): boolean {
  // Check if the rule has the '__grafana_origin' label (plugin-provided)
  if (rule.labels?.__grafana_origin) {
    return true;
  }

  // Check if the rule is from integrations
  if (rule.labels?.namespace?.startsWith('integrations-')) {
    return true;
  }

  // Check if the rule is from synthetics
  if (rule.labels?.namespace === 'synthetic_monitoring') {
    return true;
  }

  return false;
}
