import { useMemo } from 'react';

import { contextSrv as ctx } from 'app/core/services/context_srv';
import { useFolder } from 'app/features/alerting/unified/hooks/useFolder';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { type GrafanaPromRuleDTO, type RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useGetPluginSettingsQuery } from '../../api/pluginsApi';
import { getRulesPermissions } from '../../utils/access-control';
import { getGroupOriginName } from '../../utils/groupIdentifier';
import { isAdmin } from '../../utils/misc';
import {
  getRulePluginOrigin,
  isProvisionedPromRule,
  isProvisionedRule,
  prometheusRuleType,
  rulerRuleType,
} from '../../utils/rules';
import { useIsRuleEditable } from '../useIsRuleEditable';

import {
  type Abilities,
  type Ability,
  ExternalRuleAction,
  Granted,
  InsufficientPermissions,
  IsPluginManaged,
  Loading,
  NotSupported,
  Provisioned,
  RuleAction,
} from './types';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Builds the Ability for a silence action.
 * Extracted to avoid repeating the same if-chain in both the Ruler and Prom paths.
 */
function buildSilenceAbility(loading: boolean, supported: boolean, canSilence: boolean): Ability {
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

function fromPermissions(supported: boolean, loading: boolean, ...anyOfPermissions: AccessControlAction[]): Ability {
  if (loading) {
    return Loading;
  }
  if (!supported) {
    return NotSupported;
  }
  const hasAny = anyOfPermissions.some((p) => p && ctx.hasPermission(p));
  if (!hasAny) {
    return InsufficientPermissions(anyOfPermissions);
  }
  return Granted;
}

// ── Grafana-managed rule abilities (global / list level) ──────────────────────

export function useRuleAbilities(): Abilities<RuleAction> {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);
  const canRead = ctx.hasPermission(AccessControlAction.AlertingRuleRead);
  const canUpdate = ctx.hasPermission(AccessControlAction.AlertingRuleUpdate);
  const canDelete = ctx.hasPermission(AccessControlAction.AlertingRuleDelete);

  return useMemo<Abilities<RuleAction>>(
    () => ({
      [RuleAction.Create]: canCreate ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleCreate]),
      [RuleAction.View]: canRead ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleRead]),
      [RuleAction.Update]: canUpdate ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]),
      [RuleAction.Delete]: canDelete ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleDelete]),
      [RuleAction.ExportRules]: canRead ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleRead]),
      // per-instance actions are not meaningful at list level
      [RuleAction.Duplicate]: NotSupported,
      [RuleAction.Explore]: NotSupported,
      [RuleAction.Silence]: NotSupported,
      [RuleAction.ModifyExport]: NotSupported,
      [RuleAction.Pause]: NotSupported,
      [RuleAction.Restore]: NotSupported,
      [RuleAction.DeletePermanently]: NotSupported,
    }),
    [canCreate, canRead, canUpdate, canDelete]
  );
}

export function useRuleAbility(action: RuleAction): Ability {
  const all = useRuleAbilities();
  return useMemo(() => all[action], [all, action]);
}

// ── External datasource rule abilities (global / list level) ──────────────────

export function useExternalRuleAbilities(): Abilities<ExternalRuleAction> {
  const canWrite = ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite);
  const canRead = ctx.hasPermission(AccessControlAction.AlertingRuleExternalRead);

  return useMemo<Abilities<ExternalRuleAction>>(
    () => ({
      [ExternalRuleAction.CreateAlertRule]: canWrite
        ? Granted
        : InsufficientPermissions([AccessControlAction.AlertingRuleExternalWrite]),
      [ExternalRuleAction.ViewAlertRule]: canRead
        ? Granted
        : InsufficientPermissions([AccessControlAction.AlertingRuleExternalRead]),
      [ExternalRuleAction.UpdateAlertRule]: canWrite
        ? Granted
        : InsufficientPermissions([AccessControlAction.AlertingRuleExternalWrite]),
      [ExternalRuleAction.DeleteAlertRule]: canWrite
        ? Granted
        : InsufficientPermissions([AccessControlAction.AlertingRuleExternalWrite]),
    }),
    [canWrite, canRead]
  );
}

export function useExternalRuleAbility(action: ExternalRuleAction): Ability {
  const all = useExternalRuleAbilities();
  return useMemo(() => all[action], [all, action]);
}

// ── Plugin immutability ───────────────────────────────────────────────────────

function useRulePluginImmutability(rule: RulerRuleDTO | GrafanaPromRuleDTO | undefined): {
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

// ── Per-rule edit ability ─────────────────────────────────────────────────────

export interface RuleEditAbilityResult {
  /**
   * Edit (update) the rule. Denied when: loading, ruler unavailable, provisioned
   * (`PROVISIONED`), plugin-managed (`IS_PLUGIN_MANAGED`), or no folder edit permission.
   */
  update: Ability;
  /** Delete the rule. Same conditions as `update` but checks delete permission. */
  delete: Ability;
  /**
   * Restore the rule to a previous version. Same as `update` but additionally
   * returns `NOT_SUPPORTED` for non-Grafana-managed rules (cloud/recording rules
   * do not have version history).
   */
  restore: Ability;
  /**
   * Pause / resume the rule. Same as `restore` — only applicable to Grafana-managed
   * alerting rules; returns `NOT_SUPPORTED` for recording rules and cloud rules.
   */
  pause: Ability;
  /**
   * Duplicate the rule. Not blocked by provisioning (a provisioned rule can be
   * duplicated to create a new editable copy). Returns `IS_PLUGIN_MANAGED` when
   * the rule is plugin-owned, otherwise checks the create permission.
   */
  duplicate: Ability;
  /**
   * Permanently delete the rule (purge from trash). Only applicable to Grafana-managed
   * alerting rules. Requires both delete permission and Grafana admin status.
   */
  deletePermanently: Ability;
  /** True while async checks (ruler, plugin settings) are still in flight. */
  loading: boolean;
}

/**
 * Resolves the per-rule edit abilities for a RulerRule, combining:
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
    // TODO: Add support for federated rules
    const isFederated = false;
    const isGrafanaManagedRule = rulerRuleType.grafana.rule(rule);
    const loading = editableLoading || pluginLoading;
    const rulesPermissions = getRulesPermissions(rulesSourceName);

    function computeEdit(hasPermission: boolean, permission: AccessControlAction): Ability {
      if (loading) {
        return Loading;
      }
      if (!isRulerAvailable) {
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

    const update = computeEdit(isEditable ?? false, rulesPermissions.update);
    const del = computeEdit(isRemovable ?? false, rulesPermissions.delete);

    // Restore and pause only apply to Grafana-managed rules.
    const grafanaOnlyUpdate = isGrafanaManagedRule ? update : NotSupported;

    // Duplicate is not blocked by provisioning — a provisioned rule can be copied.
    function computeDuplicate(): Ability {
      if (loading) {
        return Loading;
      }
      if (isPluginManaged) {
        return IsPluginManaged;
      }
      return fromPermissions(true, false, rulesPermissions.create);
    }

    // Permanent deletion requires both delete permission and Grafana admin status.
    function computeDeletePermanently(): Ability {
      if (!isGrafanaManagedRule) {
        return NotSupported;
      }
      if (!del.granted) {
        // Propagate the underlying cause (LOADING, PROVISIONED, IS_PLUGIN_MANAGED, etc.)
        return del;
      }
      if (!isAdmin()) {
        // Admin is a role, not an RBAC permission — anyOfPermissions is empty to signal
        // "this requires Grafana Admin role" rather than a grantable permission action.
        return InsufficientPermissions([]);
      }
      return Granted;
    }

    return {
      update,
      delete: del,
      restore: grafanaOnlyUpdate,
      pause: grafanaOnlyUpdate,
      duplicate: computeDuplicate(),
      deletePermanently: computeDeletePermanently(),
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

// ── Focused per-rule ability hooks ────────────────────────────────────────────

/**
 * Returns the silence `Ability` for a rule.
 * Checks alertmanager configuration and folder-level silence permissions.
 */
export function useRuleSilenceAbility(rule: RulerRuleDTO | undefined): Ability {
  const { silenceSupported, canSilenceInFolder, silenceLoading } = useCanSilence(rule);
  return useMemo(
    () => buildSilenceAbility(silenceLoading, silenceSupported, canSilenceInFolder),
    [silenceLoading, silenceSupported, canSilenceInFolder]
  );
}

/**
 * Returns the explore `Ability`.
 * This is a pure synchronous global RBAC check — `DataSourcesExplore` has no
 * folder-scoped or async dependency, so no rule or group identifier is needed.
 */
export function useRuleExploreAbility(): Ability {
  return fromPermissions(true, false, AccessControlAction.DataSourcesExplore);
}

/**
 * Returns the export/modify-export `Ability` for a rule.
 * Only applicable to Grafana-managed alerting rules; returns `NOT_SUPPORTED` for cloud rules.
 */
export function useRuleExportAbility(rule: RulerRuleDTO | undefined): Ability {
  const isGrafanaManagedRule = rulerRuleType.grafana.rule(rule);
  const exportAbility = useRuleAbility(RuleAction.ExportRules);
  return useMemo(() => (isGrafanaManagedRule ? exportAbility : NotSupported), [isGrafanaManagedRule, exportAbility]);
}

// ── Per-rule (PromRule) focused ability hooks ─────────────────────────────────

export const skipToken = Symbol('ability-skip-token');
type SkipToken = typeof skipToken;

export interface PromRuleAdministrationAbilityResult {
  /** Edit the rule. Denied when: loading, provisioned, plugin-managed, or no folder edit permission. */
  update: Ability;
  /** Delete the rule. Same conditions as `update` but checks delete permission. */
  delete: Ability;
  /**
   * Pause/resume the rule. Same as `update` but `NOT_SUPPORTED` for recording rules —
   * only alerting rules can be paused.
   */
  pause: Ability;
  /**
   * Restore the rule to a previous version. Same as `update` but `NOT_SUPPORTED` for
   * recording rules — only alerting rules have version history.
   */
  restore: Ability;
  /**
   * Duplicate the rule. Not blocked by provisioning. Returns `IS_PLUGIN_MANAGED` when
   * the rule is plugin-owned, otherwise checks the create permission.
   */
  duplicate: Ability;
  /**
   * Permanently delete the rule (purge from trash). Only applicable to Grafana-managed
   * alerting rules. Requires both delete permission and Grafana admin status.
   */
  deletePermanently: Ability;
  /** True while async checks (folder metadata, plugin settings) are still in flight. */
  loading: boolean;
}

/**
 * Resolves the per-rule administration abilities for a Grafana PromRule, combining:
 * - Provisioning state (`PROVISIONED`)
 * - Plugin ownership (`IS_PLUGIN_MANAGED`)
 * - Folder-scoped RBAC permissions
 *
 * Priority: LOADING > PROVISIONED > IS_PLUGIN_MANAGED > INSUFFICIENT_PERMISSIONS
 *
 * Pass `skipToken` when no prom rule is available — all fields return `NOT_SUPPORTED`.
 */
export function usePromRuleAdministrationAbility(
  rule: GrafanaPromRuleDTO | SkipToken
): PromRuleAdministrationAbilityResult {
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

    const isProvisioned = rule ? isProvisionedPromRule(rule) : false;
    const isFederated = false;
    const isAlertingRule = prometheusRuleType.grafana.alertingRule(rule);
    const loading = editableLoading || pluginLoading;
    const rulesPermissions = getRulesPermissions('grafana');

    function computeEdit(hasPermission: boolean, permission: AccessControlAction): Ability {
      if (loading) {
        return Loading;
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

    const update = computeEdit(isEditable ?? false, rulesPermissions.update);
    const del = computeEdit(isRemovable ?? false, rulesPermissions.delete);

    // Pause and restore only apply to alerting rules
    const alertingOnly = (base: Ability): Ability => (isAlertingRule ? base : NotSupported);

    function computeDuplicate(): Ability {
      if (loading) {
        return Loading;
      }
      if (isPluginManaged) {
        return IsPluginManaged;
      }
      return fromPermissions(true, false, rulesPermissions.create);
    }

    // Permanent deletion requires both delete permission and Grafana admin status.
    function computeDeletePermanently(): Ability {
      if (!isAlertingRule) {
        return NotSupported;
      }
      if (!del.granted) {
        // Propagate the underlying cause (LOADING, PROVISIONED, IS_PLUGIN_MANAGED, etc.)
        return del;
      }
      if (!isAdmin()) {
        // Admin is a role, not an RBAC permission — anyOfPermissions is empty to signal
        // "this requires Grafana Admin role" rather than a grantable permission action.
        return InsufficientPermissions([]);
      }
      return Granted;
    }

    return {
      update,
      delete: del,
      pause: alertingOnly(update),
      restore: alertingOnly(update),
      duplicate: computeDuplicate(),
      deletePermanently: computeDeletePermanently(),
      loading,
    };
  }, [rule, editableLoading, pluginLoading, isEditable, isRemovable, isPluginManaged]);
}

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

/**
 * Returns the export/modify-export `Ability` for a Grafana PromRule.
 * Only applicable to Grafana-managed **alerting** rules (not recording rules).
 * Pass `skipToken` when no prom rule is available.
 */
export function usePromRuleExportAbility(rule: GrafanaPromRuleDTO | SkipToken): Ability {
  const promRule = rule === skipToken ? undefined : rule;
  const isAlertingRule = promRule ? prometheusRuleType.grafana.alertingRule(promRule) : false;
  const exportAbility = useRuleAbility(RuleAction.ExportRules);
  return useMemo(() => (isAlertingRule ? exportAbility : NotSupported), [isAlertingRule, exportAbility]);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface IsGrafanaPromRuleEditableResult {
  isEditable: boolean;
  isRemovable: boolean;
  loading: boolean;
}

function useIsGrafanaPromRuleEditable(rule?: GrafanaPromRuleDTO): IsGrafanaPromRuleEditableResult {
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

const { useGetGrafanaAlertingConfigurationStatusQuery } = alertmanagerApi;

function useGrafanaRulesSilenceSupport(): { silenceSupported: boolean; silenceLoading: boolean } {
  const { currentData: amConfigStatus, isLoading } = useGetGrafanaAlertingConfigurationStatusQuery(undefined);
  if (isLoading) {
    return { silenceSupported: false, silenceLoading: true };
  }
  const interactsOnlyWithExternalAMs = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.External;
  const interactsWithAll = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.All;
  const silenceSupported = !interactsOnlyWithExternalAMs || interactsWithAll;
  return { silenceSupported, silenceLoading: false };
}

function useCanSilence(rule?: RulerRuleDTO): {
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

function useCanSilenceInFolder(folderUID?: string) {
  const folderPermissions = useFolderPermissions(folderUID);
  const hasFolderSilencePermission = folderPermissions[AccessControlAction.AlertingSilenceCreate] ?? false;
  const hasGlobalSilencePermission = ctx.hasPermission(AccessControlAction.AlertingInstanceCreate);
  return hasGlobalSilencePermission || hasFolderSilencePermission;
}

function useFolderPermissions(folderUID?: string): Record<string, boolean> {
  const { folder } = useFolder(folderUID);
  return folder?.accessControl ?? {};
}
