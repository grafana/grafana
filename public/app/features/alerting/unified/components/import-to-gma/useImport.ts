import { load } from 'js-yaml';
import { useCallback, useMemo, useRef, useState } from 'react';

import { isDefaultRoutingTreeName } from '@grafana/alerting';
import { t } from '@grafana/i18n';
import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { fetchAlertManagerConfig } from '../../api/alertmanager';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { stringifyErrorLike } from '../../utils/misc';

import { findDuplicateTemplateFileName } from './steps/utils';
import type { ConvertAlertmanagerResponse, DryRunValidationResult, MergeStats, PromoteStatsSummary } from './types';

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
function parseAlertmanagerYaml(yamlContent: string): ParsedAlertmanagerYaml {
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
  /**
   * Separate notification template files uploaded alongside the YAML config.
   * On disk users keep the Alertmanager config and template files separately (mimirtool combines
   * them on the fly); the wizard reads these and merges them into the request's template_files map.
   */
  templateFiles?: File[];
  /** Configuration identifier - the name of the extra config (policy tree name) */
  configIdentifier: string;
  /** If true, promote (merge) the imported config into the main Grafana config */
  promote?: boolean;
}

/**
 * Read uploaded notification template files into a { fileName: content } map, keyed by file name —
 * matching how mimirtool and the convert API key `template_files` (and how Grafana names the
 * resulting template groups). Throws if two files share the same name, since the key would be
 * ambiguous.
 */
export async function readTemplateFiles(files: File[] = []): Promise<Record<string, string>> {
  const duplicate = findDuplicateTemplateFileName(files);
  if (duplicate) {
    throw new Error(
      t('alerting.import-to-gma.templates.duplicate-file-name', 'Duplicate template file name: "{{name}}"', {
        name: duplicate,
      })
    );
  }
  const entries = await Promise.all(files.map(async (file) => [file.name, await file.text()] as const));
  return Object.fromEntries(entries);
}

/**
 * Merge separately-uploaded template files on top of any template_files already embedded in the
 * config. A name that exists in both is ambiguous, so reject it rather than silently overwriting.
 */
export function mergeTemplateFiles(
  embedded: Record<string, string>,
  uploaded: Record<string, string>
): Record<string, string> {
  for (const name of Object.keys(uploaded)) {
    if (name in embedded) {
      throw new Error(
        t(
          'alerting.import-to-gma.templates.conflicts-with-config',
          'Template file "{{name}}" conflicts with a template already defined in the config',
          { name }
        )
      );
    }
  }
  return { ...embedded, ...uploaded };
}

/**
 * Resolve the alertmanager config and template files from a YAML file or datasource.
 * Shared between import and dry-run flows.
 */
async function resolveAlertmanagerConfig(params: NotificationsSourceParams): Promise<ParsedAlertmanagerYaml> {
  const { source, datasourceName, yamlFile, templateFiles } = params;

  if (source === 'yaml' && yamlFile) {
    const yamlContent = await yamlFile.text();
    const parsed = parseAlertmanagerYaml(yamlContent);
    const uploadedTemplates = await readTemplateFiles(templateFiles);

    return {
      alertmanagerConfig: parsed.alertmanagerConfig,
      templateFiles: mergeTemplateFiles(parsed.templateFiles, uploadedTemplates),
    };
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

interface MigrateRulesBaseParams {
  dataSourceUID: string;
  targetFolderUID?: string;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  payload: RulerRulesConfigDTO;
  targetDatasourceUID?: string;
}

type MigrateRulesParams = MigrateRulesBaseParams & { notificationSettings?: string };

export function buildRoutingParams(
  selectedRoutingTreeName: string | undefined
): Pick<MigrateRulesParams, 'notificationSettings'> {
  return {
    notificationSettings: isDefaultRoutingTreeName(selectedRoutingTreeName)
      ? undefined
      : JSON.stringify({ policy: selectedRoutingTreeName }),
  };
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

      return await convertAlertmanagerConfig({
        alertmanagerConfig,
        templateFiles,
        configIdentifier: params.configIdentifier,
        forceReplace: true,
        promote: params.promote,
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
        notificationSettings,
      } = params;

      await convert({
        dataSourceUID,
        targetFolderUID,
        pauseRecordingRules,
        pauseAlerts: pauseAlertingRules,
        payload,
        targetDatasourceUID,
        notificationSettings,
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
 * Summarize the per-type merge stats from a promote (dry-run or real) into counts
 * for display on the review screen.
 */
export function summarizeMergeStats(stats: MergeStats | undefined): PromoteStatsSummary {
  return {
    route: Boolean(stats?.added_route),
    receivers: stats?.added_receivers?.length ?? 0,
    templates: stats?.added_templates?.length ?? 0,
    timeIntervals: stats?.added_time_intervals?.length ?? 0,
    inhibitionRules: stats?.added_inhibition_rules?.length ?? 0,
  };
}

/**
 * Parse the backend ConvertAlertmanagerResponse into a UI-friendly DryRunValidationResult.
 */
export function parseDryRunResponse(response: ConvertAlertmanagerResponse): DryRunValidationResult {
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
    stats: response.stats ? summarizeMergeStats(response.stats) : undefined,
  };
}

/**
 * Combine the dry-run mutation's cached data with any error into a single UI result.
 * A pre-run failure (e.g. a template conflict) sets an error while the previous
 * successful response is still cached, so the error must take precedence over the
 * stale data — otherwise the review step would report the config as ready to import.
 */
export function deriveDryRunResult(
  dryRunData: DryRunValidationResult | undefined,
  dryRunError: string | undefined
): DryRunValidationResult | undefined {
  if (dryRunError) {
    return { valid: false, error: dryRunError, renamedReceivers: [], renamedTimeIntervals: [], stats: undefined };
  }
  if (dryRunData) {
    return dryRunData;
  }
  return undefined;
}

/**
 * Hook to perform dry-run validation for Alertmanager config import.
 * Uses POST /api/convert/api/v1/alerts with X-Grafana-Alerting-Dry-Run: true.
 * Validates the config and checks for conflicts without saving.
 */
export function useDryRunNotifications() {
  const [dryRunAlertmanagerConfig, { isLoading, data, error: mutationError, reset: resetMutation }] =
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
          promote: params.promote,
        });
      } catch (err) {
        setPreRunError(stringifyErrorLike(err));
      }
    },
    [dryRunAlertmanagerConfig]
  );

  // RTK recreates the mutation's `reset` on every trigger (its identity tracks the in-flight request),
  // so keep the latest in a ref and expose a stable `reset`. Callers use it as an effect dependency
  // (Step 1 trigger effect); an unstable identity would re-fire that effect and loop dry-runs forever.
  const resetMutationRef = useRef(resetMutation);
  resetMutationRef.current = resetMutation;

  // Clear the cached response and any pre-run error so `result` returns to undefined. Called when the
  // step is no longer runnable (e.g. a duplicate template name) so a previously successful dry-run
  // can't keep reporting the config as valid once the inputs have become invalid.
  const reset = useCallback(() => {
    setPreRunError(undefined);
    resetMutationRef.current();
  }, []);

  const parsed = useMemo(() => (data ? parseDryRunResponse(data) : undefined), [data]);
  const error = mutationError ? stringifyErrorLike(mutationError) : preRunError;
  // Combine data and error here (error wins) so callers consume a single ready-to-use result.
  const result = useMemo(() => deriveDryRunResult(parsed, error), [parsed, error]);

  return { runDryRun, reset, isLoading, result, error };
}
