import { useMemo } from 'react';

import { contextSrv as ctx } from 'app/core/services/context_srv';
import { useFolder } from 'app/features/alerting/unified/hooks/useFolder';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type GrafanaPromRuleDTO, type RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { useGetPluginSettingsQuery } from '../../../api/pluginsApi';
import { getRulesPermissions } from '../../../utils/access-control';
import { isAdmin } from '../../../utils/misc';
import { getRulePluginOrigin } from '../../../utils/rules';
import {
  type AsyncAbility,
  Granted,
  InsufficientPermissions,
  IsPluginManaged,
  Loading,
  NotSupported,
  Provisioned,
} from '../types';

// ── Sentinel token ────────────────────────────────────────────────────────────

/** Pass instead of a rule when no rule is available — all abilities return `NOT_SUPPORTED`. */
export const skipToken = Symbol('ability-skip-token');
export type SkipToken = typeof skipToken;

// ── Shared result type ────────────────────────────────────────────────────────

export interface RuleEditAbilityResult {
  /**
   * Edit (update) the rule. Denied when: loading, ruler unavailable, provisioned
   * (`PROVISIONED`), plugin-managed (`IS_PLUGIN_MANAGED`), or no folder edit permission.
   */
  update: AsyncAbility;
  /** Delete the rule. Same conditions as `update` but checks delete permission. */
  delete: AsyncAbility;
  /**
   * Restore the rule to a previous version. Same as `update` but additionally
   * returns `NOT_SUPPORTED` for non-Grafana-managed rules (cloud/recording rules
   * do not have version history).
   */
  restore: AsyncAbility;
  /**
   * Pause / resume the rule. Same as `restore` — only applicable to Grafana-managed
   * alerting rules; returns `NOT_SUPPORTED` for recording rules and cloud rules.
   */
  pause: AsyncAbility;
  /**
   * Duplicate the rule. Not blocked by provisioning (a provisioned rule can be
   * duplicated to create a new editable copy). Returns `IS_PLUGIN_MANAGED` when
   * the rule is plugin-owned, otherwise checks the create permission.
   */
  duplicate: AsyncAbility;
  /**
   * Permanently delete the rule (purge from trash). Only applicable to Grafana-managed
   * alerting rules. Requires both delete permission and Grafana admin status.
   */
  deletePermanently: AsyncAbility;
  /** True while async checks (ruler, plugin settings, folder) are still in flight. */
  loading: boolean;
}

// ── Pure ability builders ─────────────────────────────────────────────────────

/**
 * Builds the {@link AsyncAbility} for a silence action.
 * Extracted to avoid repeating the same if-chain in both the Ruler and Prom paths.
 */
export function buildSilenceAbility(loading: boolean, supported: boolean, canSilence: boolean): AsyncAbility {
  if (loading) {
    return Loading;
  }
  if (!supported) {
    return NotSupported;
  }
  if (!canSilence) {
    return InsufficientPermissions([
      AccessControlAction.AlertingSilenceCreate,
      AccessControlAction.AlertingInstanceCreate,
    ]);
  }
  return Granted;
}

/**
 * Computes the edit (update or delete) {@link AsyncAbility} for a rule.
 * Shared between the Ruler and Prom paths — the only difference is whether
 * `supported` reflects ruler availability (Ruler path) or is always `true` (Prom path).
 *
 * Priority: LOADING > NOT_SUPPORTED > PROVISIONED > IS_PLUGIN_MANAGED > INSUFFICIENT_PERMISSIONS
 */
export function computeRuleEditAbility(
  loading: boolean,
  supported: boolean,
  isProvisioned: boolean,
  isFederated: boolean,
  isPluginManaged: boolean,
  hasPermission: boolean,
  permission: AccessControlAction
): AsyncAbility {
  if (loading) {
    return Loading;
  }
  if (!supported) {
    return NotSupported;
  }
  if (isProvisioned || isFederated) {
    return Provisioned;
  }
  if (isPluginManaged) {
    return IsPluginManaged;
  }
  if (!hasPermission) {
    return InsufficientPermissions([permission]);
  }
  return Granted;
}

/**
 * Computes the duplicate {@link AsyncAbility} for a rule.
 * Shared between the Ruler and Prom paths — duplicate is intentionally not blocked
 * by provisioning (a provisioned rule can be copied to create a new editable one).
 */
export function computeRuleDuplicateAbility(
  loading: boolean,
  isPluginManaged: boolean,
  createPermission: AccessControlAction
): AsyncAbility {
  if (loading) {
    return Loading;
  }
  if (isPluginManaged) {
    return IsPluginManaged;
  }
  const hasAny = ctx.hasPermission(createPermission);
  return hasAny ? Granted : InsufficientPermissions([createPermission]);
}

/**
 * Computes the permanent-delete {@link AsyncAbility} for a rule.
 * Shared between the Ruler and Prom paths.
 *
 * `isApplicable` should be `false` for non-Grafana-managed or recording rules
 * (caller decides based on rule type). When the underlying `deleteAbility` is
 * denied, its cause is propagated directly so the UI shows the right tooltip.
 */
export function computeRuleDeletePermanentlyAbility(isApplicable: boolean, deleteAbility: AsyncAbility): AsyncAbility {
  if (!isApplicable) {
    return NotSupported;
  }
  if (!deleteAbility.granted) {
    return deleteAbility;
  }
  if (!isAdmin()) {
    return InsufficientPermissions([]);
  }
  return Granted;
}

// ── Shared internal hooks ─────────────────────────────────────────────────────

/** Resolves whether a rule is managed by an installed plugin (async). */
export function useRulePluginImmutability(rule: RulerRuleDTO | GrafanaPromRuleDTO | undefined): {
  isPluginManaged: boolean;
  pluginLoading: boolean;
} {
  const pluginOrigin = getRulePluginOrigin(rule);
  const { data: pluginSettings, isLoading } = useGetPluginSettingsQuery(pluginOrigin?.pluginId ?? '', {
    skip: !pluginOrigin?.pluginId,
  });
  const isPluginInstalled = pluginSettings?.enabled ?? false;

  return useMemo(
    () => ({
      isPluginManaged: pluginOrigin ? isLoading || isPluginInstalled : false,
      pluginLoading: isLoading && Boolean(pluginOrigin?.pluginId),
    }),
    [pluginOrigin, isLoading, isPluginInstalled]
  );
}

const { useGetGrafanaAlertingConfigurationStatusQuery } = alertmanagerApi;

/** Returns whether the Grafana alertmanager supports silences (based on AM config). */
export function useGrafanaRulesSilenceSupport(): { silenceSupported: boolean; silenceLoading: boolean } {
  const { currentData: amConfigStatus, isLoading } = useGetGrafanaAlertingConfigurationStatusQuery(undefined);
  if (isLoading) {
    return { silenceSupported: false, silenceLoading: true };
  }
  const interactsOnlyWithExternalAMs = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.External;
  const interactsWithAll = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.All;
  const silenceSupported = !interactsOnlyWithExternalAMs || interactsWithAll;
  return { silenceSupported, silenceLoading: false };
}

/** Returns whether the user can create silences in a specific folder. */
export function useCanSilenceInFolder(folderUID?: string): boolean {
  const folderPermissions = useFolderPermissions(folderUID);
  const hasFolderSilencePermission = folderPermissions[AccessControlAction.AlertingSilenceCreate] ?? false;
  const hasGlobalSilencePermission = ctx.hasPermission(AccessControlAction.AlertingInstanceCreate);
  return hasGlobalSilencePermission || hasFolderSilencePermission;
}

/** Returns the RBAC `accessControl` map for a folder. */
export function useFolderPermissions(folderUID?: string): Record<string, boolean> {
  const { folder } = useFolder(folderUID);
  return folder?.accessControl ?? {};
}

/** Resolves folder-scoped edit/delete permissions for a Grafana PromRule. */
export function useIsGrafanaPromRuleEditable(rule?: GrafanaPromRuleDTO): {
  isEditable: boolean;
  isRemovable: boolean;
  loading: boolean;
} {
  const folderUID = rule?.folderUid;
  const { folder, loading } = useFolder(folderUID);

  return useMemo(() => {
    if (!rule || !folderUID) {
      return { isEditable: false, isRemovable: false, loading: false };
    }
    if (!folder) {
      return { isEditable: false, isRemovable: false, loading };
    }
    const rulesPermissions = getRulesPermissions('grafana');
    const canEditGrafanaRules = ctx.hasPermissionInMetadata(rulesPermissions.update, folder);
    const canRemoveGrafanaRules = ctx.hasPermissionInMetadata(rulesPermissions.delete, folder);
    return { isEditable: canEditGrafanaRules, isRemovable: canRemoveGrafanaRules, loading };
  }, [rule, folderUID, folder, loading]);
}
