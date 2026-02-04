import { useCallback, useState } from 'react';

import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { fetchAlertManagerConfig } from '../../api/alertmanager';
import { convertToGMAApi } from '../../api/convertToGMAApi';

import type { DryRunValidationResult } from './types';

interface MigrateNotificationsParams {
  source: 'datasource' | 'yaml';
  /** Datasource name (not UID) - required when source is 'datasource' */
  datasourceName?: string;
  yamlFile: File | null;
  mergeMatchers: string; // e.g., "__grafana_managed_route__=my-policy" (uses MERGE_MATCHERS_LABEL_NAME constant)
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
 * Hook to import notification resources (contact points, policies, templates, time intervals)
 * Uses the /api/convert/api/v1/alerts endpoint via RTK Query
 */
export function useImportNotifications() {
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
        throw new Error('Invalid import source configuration');
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
 * Hook to import alert rules and recording rules
 * Uses the convertToGMAApi (same as ImportToGMARules)
 */
export function useImportRules() {
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

interface DryRunNotificationsParams {
  source: 'datasource' | 'yaml';
  /** Datasource name (not UID) - required when source is 'datasource' */
  datasourceName?: string;
  yamlFile: File | null;
  mergeMatchers: string;
}

/**
 * Hook to perform dry-run validation for Alertmanager config import.
 * This validates the config and checks for conflicts before actually importing.
 *
 * TODO: The backend endpoint doesn't exist yet. See https://github.com/grafana/alerting-squad/issues/1378
 * For now, this hook provides a way to:
 * 1. Skip validation entirely (when skipValidation=true or endpoint not available)
 * 2. Mock the response for UI development/testing
 *
 * When the endpoint is ready:
 * - Remove the mock logic
 * - Remove the skipValidation option (or keep it for testing)
 * - The endpoint should return: { valid: boolean, error?: string, renamedReceivers: [], renamedTimeIntervals: [] }
 */
export function useDryRunNotifications() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DryRunValidationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // TODO: Uncomment when the backend endpoint is implemented
  // const [dryRunAlertmanagerConfig] = convertToGMAApi.useDryRunAlertmanagerConfigMutation();

  const runDryRun = useCallback(
    async (
      params: DryRunNotificationsParams,
      options: { skipValidation?: boolean } = {}
    ): Promise<DryRunValidationResult> => {
      const { source, datasourceName, yamlFile, mergeMatchers } = params;
      const { skipValidation = false } = options;

      // If skipValidation is true, return a success result immediately
      // This allows the UI to proceed without validation when the endpoint doesn't exist
      if (skipValidation) {
        const successResult: DryRunValidationResult = {
          valid: true,
          renamedReceivers: [],
          renamedTimeIntervals: [],
        };
        setResult(successResult);
        return successResult;
      }

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        let alertmanagerConfig: string;
        let templateFiles: Record<string, string> = {};

        if (source === 'yaml' && yamlFile) {
          alertmanagerConfig = await yamlFile.text();
        } else if (source === 'datasource' && datasourceName) {
          const config = await fetchAlertManagerConfig(datasourceName);
          alertmanagerConfig = JSON.stringify(config.alertmanager_config);
          templateFiles = config.template_files ?? {};
        } else {
          throw new Error('Invalid import source configuration');
        }

        // TODO: Uncomment when the backend endpoint is implemented
        // const response = await dryRunAlertmanagerConfig({
        //   alertmanagerConfig,
        //   templateFiles,
        //   mergeMatchers,
        // }).unwrap();
        // setResult(response);
        // return response;

        // MOCK: For now, simulate a successful dry-run
        // This allows UI development to continue while waiting for the backend
        // Remove this mock once the endpoint is ready
        console.warn('[useDryRunNotifications] Backend endpoint not implemented yet. Using mock response.', {
          alertmanagerConfig: alertmanagerConfig.substring(0, 100) + '...',
          templateFiles,
          mergeMatchers,
        });

        // Simulate a small delay to show loading state
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Mock response - always returns success with no renames
        // In real implementation, the backend would analyze the config and return actual renames
        const mockResult: DryRunValidationResult = {
          valid: true,
          renamedReceivers: [],
          renamedTimeIntervals: [],
        };

        setResult(mockResult);
        return mockResult;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);

        // Return an error result
        const errorResult: DryRunValidationResult = {
          valid: false,
          error: errorObj.message,
          renamedReceivers: [],
          renamedTimeIntervals: [],
        };
        setResult(errorResult);
        return errorResult;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setResult(null);
    setError(null);
  }, []);

  return {
    runDryRun,
    isLoading,
    result,
    error,
    reset,
  };
}
