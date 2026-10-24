import { useCallback } from 'react';

import { isDefaultRoutingTreeName } from '@grafana/alerting';
import {
  type ConvertAlertmanagerResponse,
  type MergeStats,
  type NotificationSettings,
} from '@grafana/alerting/convert';
import {
  type RulerCloudRuleDTO,
  type RulerCloudRulesConfigDTO,
  type RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

import { convertApi } from '../../api/convertToGMAApi';
import { rulerRuleType } from '../../utils/rules';

import { type NotificationsSourceParams, resolveAlertmanagerConfig } from './resolveAlertmanagerConfig';
import type { DryRunState, DryRunValidationResult, PromoteStatsSummary } from './types';

interface MigrateRulesBaseParams {
  dataSourceUID: string;
  targetFolderUID?: string;
  pauseAlertingRules: boolean;
  pauseRecordingRules: boolean;
  payload: RulerCloudRulesConfigDTO;
  targetDatasourceUID?: string;
}

type MigrateRulesParams = MigrateRulesBaseParams & { notificationSettings?: NotificationSettings | null };

export function buildRoutingParams(
  selectedRoutingTreeName: string | undefined
): Pick<MigrateRulesParams, 'notificationSettings'> {
  return {
    notificationSettings:
      !selectedRoutingTreeName || isDefaultRoutingTreeName(selectedRoutingTreeName)
        ? null
        : { type: 'NamedRoutingTree', routingTree: selectedRoutingTreeName },
  };
}

/**
 * Hook to import notification resources (contact points, policies, templates, time intervals)
 * Uses the /api/convert/api/v1/alerts endpoint via RTK Query
 */
export function useImportNotifications() {
  const [convertAlertmanagerConfig] = convertApi.usePostAlertmanagerConfigMutation();

  return useCallback(
    async (params: NotificationsSourceParams) => {
      const payload = await resolveAlertmanagerConfig(params);

      return await convertAlertmanagerConfig({
        payload,
        identifier: params.configIdentifier,
        forceReplace: true,
        promote: params.promote,
      }).unwrap();
    },
    [convertAlertmanagerConfig]
  );
}

/**
 * Hook to import alert rules and recording rules
 * Uses the convert API client from @grafana/alerting/convert
 */
export function useImportRules() {
  const [convert] = convertApi.usePostRuleGroupsMutation();

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
        payload,
        datasourceUid: dataSourceUID,
        folderUid: targetFolderUID,
        recordingRulesPaused: pauseRecordingRules,
        alertRulesPaused: pauseAlertingRules,
        targetDatasourceUid: targetDatasourceUID,
        notificationSettings,
        // Imported rules stay editable in the UI.
        disableProvenance: true,
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
): { filteredConfig: RulerCloudRulesConfigDTO; someRulesAreSkipped: boolean } {
  const filteredConfig: RulerCloudRulesConfigDTO = {};
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
        // Only data source rules can be imported, so Grafana-managed rules are skipped too.
        const filteredRules = group.rules.filter((rule): rule is RulerCloudRuleDTO => {
          const shouldSkip = !rulerRuleType.dataSource.rule(rule) || isRuleManagedByExternalSystem(rule);
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
