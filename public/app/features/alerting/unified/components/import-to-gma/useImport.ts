import { load } from 'js-yaml';
import { useCallback, useState } from 'react';

import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { fetchAlertManagerConfig } from '../../api/alertmanager';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { stringifyErrorLike } from '../../utils/misc';

import type { ConvertAlertmanagerResponse, DryRunValidationResult } from './types';

interface ParsedAlertmanagerYaml {
  alertmanagerConfig: string;
  templateFiles: Record<string, string>;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return Object.values(value).every((v) => typeof v === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse an Alertmanager YAML file and separate template_files from the alertmanager config.
 *
 * YAML files may contain `template_files` at the top level alongside the config fields
 * (route, receivers, templates, time_intervals, etc.). The backend API expects them
 * as two separate fields in the request body:
 *   { alertmanager_config: "<config string>", template_files: { ... } }
 *
 * This function extracts `template_files` and re-serializes the remaining config as JSON.
 */
export function parseAlertmanagerYaml(yamlContent: string): ParsedAlertmanagerYaml {
  let parsed: unknown;
  try {
    parsed = load(yamlContent);
  } catch {
    return { alertmanagerConfig: yamlContent, templateFiles: {} };
  }

  if (!isRecord(parsed)) {
    return { alertmanagerConfig: yamlContent, templateFiles: {} };
  }

  const { template_files, ...configWithoutTemplates } = parsed;
  const templateFiles = isStringRecord(template_files) ? template_files : {};

  return {
    alertmanagerConfig: JSON.stringify(configWithoutTemplates),
    templateFiles,
  };
}

interface NotificationsSourceParams {
  source: 'datasource' | 'yaml';
  /** Datasource name (not UID) - required when source is 'datasource' */
  datasourceName?: string;
  yamlFile: File | null;
  /** Configuration identifier - the name of the extra config (policy tree name) */
  configIdentifier: string;
}

/**
 * Resolve the alertmanager config and template files from a YAML file or datasource.
 * Shared between import and dry-run flows.
 */
async function resolveAlertmanagerConfig(params: NotificationsSourceParams): Promise<ParsedAlertmanagerYaml> {
  const { source, datasourceName, yamlFile } = params;

  if (source === 'yaml' && yamlFile) {
    const yamlContent = await yamlFile.text();
    return parseAlertmanagerYaml(yamlContent);
  }

  if (source === 'datasource' && datasourceName) {
    const config = await fetchAlertManagerConfig(datasourceName);
    return {
      alertmanagerConfig: JSON.stringify(config.alertmanager_config),
      templateFiles: config.template_files ?? {},
    };
  }

  throw new Error('Invalid import source configuration');
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
    async (params: NotificationsSourceParams) => {
      const { alertmanagerConfig, templateFiles } = await resolveAlertmanagerConfig(params);

      await convertAlertmanagerConfig({
        alertmanagerConfig,
        templateFiles,
        configIdentifier: params.configIdentifier,
        forceReplace: true,
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

/**
 * Parse the backend ConvertAlertmanagerResponse into a UI-friendly DryRunValidationResult.
 */
function parseDryRunResponse(response: ConvertAlertmanagerResponse): DryRunValidationResult {
  const renamedReceivers = Object.entries(response.rename_resources?.receivers ?? {}).map(
    ([originalName, newName]) => ({ originalName, newName })
  );
  const renamedTimeIntervals = Object.entries(response.rename_resources?.time_intervals ?? {}).map(
    ([originalName, newName]) => ({ originalName, newName })
  );

  return {
    valid: response.status === 'success',
    error: response.error,
    renamedReceivers,
    renamedTimeIntervals,
  };
}

/**
 * Hook to perform dry-run validation for Alertmanager config import.
 * Uses POST /api/convert/api/v1/alerts with X-Grafana-Alerting-Dry-Run: true.
 * Validates the config and checks for conflicts without saving.
 */
export function useDryRunNotifications() {
  const [dryRunAlertmanagerConfig, { isLoading, data, error: mutationError }] =
    convertToGMAApi.useDryRunAlertmanagerConfigMutation();
  const [preRunError, setPreRunError] = useState<string>();

  const runDryRun = useCallback(
    async (params: NotificationsSourceParams): Promise<void> => {
      setPreRunError(undefined);
      try {
        const { alertmanagerConfig, templateFiles } = await resolveAlertmanagerConfig(params);
        await dryRunAlertmanagerConfig({
          alertmanagerConfig,
          templateFiles,
          configIdentifier: params.configIdentifier,
        });
      } catch (err) {
        setPreRunError(stringifyErrorLike(err));
      }
    },
    [dryRunAlertmanagerConfig]
  );

  const result = data ? parseDryRunResponse(data) : undefined;
  const error = mutationError ? stringifyErrorLike(mutationError) : preRunError;

  return { runDryRun, isLoading, result, error };
}
