/**
 * rulerRuleAbilities.ts — per-rule ability hooks for the Ruler API path
 *
 * Use these hooks when you have a `RulerRuleDTO` (the rule editor, rule detail views,
 * the v1 rule list). They check ruler availability, provisioning, plugin ownership,
 * and folder-scoped RBAC permissions.
 *
 * For the Prometheus API path (rule list v2), see promRuleAbilities.ts.
 * For unscoped (global / list-level) checks, see ruleAbilities.ts.
 *
 * TODO: Remove useRuleAdministrationAbility, useRuleSilenceAbility, and useRuleExportAbility
 * when the v1 rule list is removed. The v2 equivalents are in promRuleAbilities.ts.
 */

import { useMemo } from 'react';

import { useFolder } from 'app/features/alerting/unified/hooks/useFolder';
import { type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { type RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { getRulesPermissions } from '../../../utils/access-control';
import { getGroupOriginName } from '../../../utils/groupIdentifier';
import { isProvisionedRule, rulerRuleType } from '../../../utils/rules';
import { useIsRuleEditable } from '../../useIsRuleEditable';
import { type Ability, type AsyncAbility, NotSupported, RuleAction } from '../types';

import { useGlobalRuleAbility } from './ruleAbilities';
import {
  type RuleEditAbilityResult,
  buildSilenceAbility,
  computeRuleDeletePermanentlyAbility,
  computeRuleDuplicateAbility,
  computeRuleEditAbility,
  useCanSilenceInFolder,
  useGrafanaRulesSilenceSupport,
  useRulePluginImmutability,
} from './ruleAbilities.utils';

// ── useRuleAdministrationAbility ──────────────────────────────────────────────

/**
 * Resolves the per-rule administration abilities for a Ruler rule, combining:
 * - Ruler API availability
 * - Provisioning state (`PROVISIONED`)
 * - Plugin ownership (`IS_PLUGIN_MANAGED`)
 * - Folder-scoped RBAC permissions
 *
 * Priority: LOADING > NOT_SUPPORTED > PROVISIONED > IS_PLUGIN_MANAGED > INSUFFICIENT_PERMISSIONS
 */
export function useRuleAdministrationAbility(
  rule: RulerRuleDTO | undefined,
  id: RuleGroupIdentifierV2
): RuleEditAbilityResult {
  const rulesSourceName = getGroupOriginName(id);
  const {
    isEditable,
    isRemovable,
    isRulerAvailable = false,
    loading: editableLoading,
  } = useIsRuleEditable(rulesSourceName, rule);
  const { isPluginManaged, pluginLoading } = useRulePluginImmutability(rule);

  return useMemo(() => {
    const isProvisioned = rule ? isProvisionedRule(rule) : false;
    const isFederated = false; // TODO: Add support for federated rules
    const isGrafanaManagedRule = rulerRuleType.grafana.rule(rule);
    const loading = editableLoading || pluginLoading;
    const rulesPermissions = getRulesPermissions(rulesSourceName);

    const update = computeRuleEditAbility(
      loading,
      isRulerAvailable,
      isProvisioned,
      isFederated,
      isPluginManaged,
      isEditable ?? false,
      rulesPermissions.update
    );
    const del = computeRuleEditAbility(
      loading,
      isRulerAvailable,
      isProvisioned,
      isFederated,
      isPluginManaged,
      isRemovable ?? false,
      rulesPermissions.delete
    );
    const grafanaOnlyUpdate = isGrafanaManagedRule ? update : NotSupported;

    return {
      update,
      delete: del,
      restore: grafanaOnlyUpdate,
      pause: grafanaOnlyUpdate,
      duplicate: computeRuleDuplicateAbility(loading, isPluginManaged, rulesPermissions.create),
      deletePermanently: computeRuleDeletePermanentlyAbility(Boolean(isGrafanaManagedRule), del),
      loading,
    };
  }, [
    rule,
    rulesSourceName,
    isRulerAvailable,
    isPluginManaged,
    editableLoading,
    pluginLoading,
    isEditable,
    isRemovable,
  ]);
}

// ── useRuleSilenceAbility ─────────────────────────────────────────────────────

/**
 * Returns the silence `Ability` for a Ruler rule.
 * Checks alertmanager configuration and folder-level silence permissions.
 */
export function useRuleSilenceAbility(rule: RulerRuleDTO | undefined): AsyncAbility {
  const { silenceSupported, canSilenceInFolder, silenceLoading } = useRulerSilenceState(rule);
  return useMemo(
    () => buildSilenceAbility(silenceLoading, silenceSupported, canSilenceInFolder),
    [silenceLoading, silenceSupported, canSilenceInFolder]
  );
}

// ── useRuleExportAbility ──────────────────────────────────────────────────────

/**
 * Returns the export/modify-export `Ability` for a Ruler rule.
 * Only applicable to Grafana-managed alerting rules; returns `NOT_SUPPORTED` for cloud rules.
 */
export function useRuleExportAbility(rule: RulerRuleDTO | undefined): Ability {
  const isGrafanaManagedRule = rulerRuleType.grafana.rule(rule);
  const exportAbility = useGlobalRuleAbility(RuleAction.ExportRules);
  return useMemo(() => (isGrafanaManagedRule ? exportAbility : NotSupported), [isGrafanaManagedRule, exportAbility]);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function useRulerSilenceState(rule?: RulerRuleDTO): {
  silenceSupported: boolean;
  canSilenceInFolder: boolean;
  silenceLoading: boolean;
} {
  const folderUID = rulerRuleType.grafana.rule(rule) ? rule.grafana_alert.namespace_uid : undefined;
  const { loading: folderIsLoading, folder } = useFolder(folderUID);
  const isGrafanaManagedRule = rule && rulerRuleType.grafana.rule(rule);
  const isGrafanaRecording = rulerRuleType.grafana.recordingRule(rule);
  const { silenceSupported, silenceLoading: amConfigLoading } = useGrafanaRulesSilenceSupport();
  const canSilenceInFolderValue = useCanSilenceInFolder(folderUID);

  if (!rule || !isGrafanaManagedRule || isGrafanaRecording) {
    return { silenceSupported: false, canSilenceInFolder: false, silenceLoading: amConfigLoading };
  }
  if (folderIsLoading || !folder) {
    return { silenceSupported: false, canSilenceInFolder: false, silenceLoading: true };
  }
  return { silenceSupported, canSilenceInFolder: canSilenceInFolderValue, silenceLoading: amConfigLoading };
}
