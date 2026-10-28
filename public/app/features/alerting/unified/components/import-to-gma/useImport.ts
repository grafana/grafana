import { useCallback } from 'react';

import { isDefaultRoutingTreeName } from '@grafana/alerting';
import { type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { convertToGMAApi } from '../../api/convertToGMAApi';

import { type NotificationsSourceParams, resolveAlertmanagerConfig } from './resolveAlertmanagerConfig';
import type {
  ConvertAlertmanagerResponse,
  DryRunState,
  DryRunValidationResult,
  MergeStats,
  PromoteStatsSummary,
} from './types';

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

/** Derives the UI-facing dry-run state from a mutation's async state (isLoading/result/error). */
export function deriveDryRunState(
  isLoading: boolean,
  result: DryRunValidationResult | undefined,
  error: string | undefined
): DryRunState {
  if (isLoading) {
    return 'loading';
  }
  if (error || (result && !result.valid)) {
    return 'error';
  }
  if (result?.valid) {
    const hasRenames = result.renamedReceivers.length > 0 || result.renamedTimeIntervals.length > 0;
    return hasRenames ? 'warning' : 'success';
  }
  return 'idle';
}
