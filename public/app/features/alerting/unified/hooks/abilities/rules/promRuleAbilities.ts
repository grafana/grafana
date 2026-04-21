/**
 * promRuleAbilities.ts — per-rule ability hooks for the Prometheus API path
 *
 * Use these hooks when you have a `GrafanaPromRuleDTO` (the v2 rule list which
 * avoids ruler API calls). They check provisioning, plugin ownership, and
 * folder-scoped RBAC permissions without requiring ruler availability.
 *
 * Pass `skipToken` when no rule is available — all abilities return `NOT_SUPPORTED`.
 *
 * For the Ruler API path (rule editor, rule detail views), see rulerRuleAbilities.ts.
 * For unscoped (global / list-level) checks, see ruleAbilities.ts.
 */

import { useMemo } from 'react';

import { type GrafanaPromRuleDTO } from 'app/types/unified-alerting-dto';

import { getRulesPermissions } from '../../../utils/access-control';
import { isProvisionedPromRule, prometheusRuleType } from '../../../utils/rules';
import { type Ability, NotSupported, RuleAction } from '../types';

import { useGlobalRuleAbility } from './ruleAbilities';
import {
  type RuleEditAbilityResult,
  type SkipToken,
  buildSilenceAbility,
  computeRuleDeletePermanentlyAbility,
  computeRuleDuplicateAbility,
  computeRuleEditAbility,
  skipToken,
  useCanSilenceInFolder,
  useGrafanaRulesSilenceSupport,
  useIsGrafanaPromRuleEditable,
  useRulePluginImmutability,
} from './ruleAbilities.utils';

// ── usePromRuleAdministrationAbility ─────────────────────────────────────────

/**
 * Resolves the per-rule administration abilities for a Grafana PromRule, combining:
 * - Provisioning state (`PROVISIONED`)
 * - Plugin ownership (`IS_PLUGIN_MANAGED`)
 * - Folder-scoped RBAC permissions
 *
 * Pass `skipToken` when no prom rule is available — all fields return `NOT_SUPPORTED`.
 *
 * Priority: LOADING > PROVISIONED > IS_PLUGIN_MANAGED > INSUFFICIENT_PERMISSIONS
 */
export function usePromRuleAdministrationAbility(rule: GrafanaPromRuleDTO | SkipToken): RuleEditAbilityResult {
  const promRule = rule === skipToken ? undefined : rule;
  const { isEditable, isRemovable, loading: editableLoading } = useIsGrafanaPromRuleEditable(promRule);
  const { isPluginManaged, pluginLoading } = useRulePluginImmutability(promRule);

  return useMemo(() => {
    if (rule === skipToken) {
      return {
        update: NotSupported,
        delete: NotSupported,
        pause: NotSupported,
        restore: NotSupported,
        duplicate: NotSupported,
        deletePermanently: NotSupported,
        loading: false,
      };
    }

    const isProvisioned = isProvisionedPromRule(rule);
    const isFederated = false;
    const isAlertingRule = prometheusRuleType.grafana.alertingRule(rule);
    const loading = editableLoading || pluginLoading;
    const rulesPermissions = getRulesPermissions('grafana');

    // The prom path has no ruler availability concept — `supported` is always true here.
    const update = computeRuleEditAbility(
      loading,
      true,
      isProvisioned,
      isFederated,
      isPluginManaged,
      isEditable ?? false,
      rulesPermissions.update
    );
    const del = computeRuleEditAbility(
      loading,
      true,
      isProvisioned,
      isFederated,
      isPluginManaged,
      isRemovable ?? false,
      rulesPermissions.delete
    );
    const alertingOnly = (base: Ability): Ability => (isAlertingRule ? base : NotSupported);

    return {
      update,
      delete: del,
      pause: alertingOnly(update),
      restore: alertingOnly(update),
      duplicate: computeRuleDuplicateAbility(loading, isPluginManaged, rulesPermissions.create),
      deletePermanently: computeRuleDeletePermanentlyAbility(isAlertingRule, del),
      loading,
    };
  }, [rule, editableLoading, pluginLoading, isEditable, isRemovable, isPluginManaged]);
}

// ── usePromRuleSilenceAbility ─────────────────────────────────────────────────

/**
 * Returns the silence `Ability` for a Grafana PromRule.
 * Checks alertmanager configuration and folder-level silence permissions.
 * Pass `skipToken` when no prom rule is available.
 */
export function usePromRuleSilenceAbility(rule: GrafanaPromRuleDTO | SkipToken): Ability {
  const promRule = rule === skipToken ? undefined : rule;
  const isAlertingRule = promRule ? prometheusRuleType.grafana.alertingRule(promRule) : false;
  const { silenceSupported, silenceLoading } = useGrafanaRulesSilenceSupport();
  const canSilenceInFolder = useCanSilenceInFolder(promRule?.folderUid);

  return useMemo(
    () => buildSilenceAbility(silenceLoading, silenceSupported, canSilenceInFolder && isAlertingRule),
    [silenceLoading, silenceSupported, canSilenceInFolder, isAlertingRule]
  );
}

// ── usePromRuleExportAbility ──────────────────────────────────────────────────

/**
 * Returns the export/modify-export `Ability` for a Grafana PromRule.
 * Only applicable to Grafana-managed **alerting** rules (not recording rules).
 * Pass `skipToken` when no prom rule is available.
 */
export function usePromRuleExportAbility(rule: GrafanaPromRuleDTO | SkipToken): Ability {
  const promRule = rule === skipToken ? undefined : rule;
  const isAlertingRule = promRule ? prometheusRuleType.grafana.alertingRule(promRule) : false;
  const exportAbility = useGlobalRuleAbility(RuleAction.ExportRules);
  return useMemo(() => (isAlertingRule ? exportAbility : NotSupported), [isAlertingRule, exportAbility]);
}
