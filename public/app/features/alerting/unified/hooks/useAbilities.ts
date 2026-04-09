import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { useFolder } from 'app/features/alerting/unified/hooks/useFolder';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { type GrafanaPromRuleDTO, type RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { useGetPluginSettingsQuery } from '../api/pluginsApi';
import { getRulesPermissions } from '../utils/access-control';
import { getGroupOriginName } from '../utils/groupIdentifier';
import { isAdmin } from '../utils/misc';
import {
  getRulePluginOrigin,
  isProvisionedPromRule,
  isProvisionedRule,
  prometheusRuleType,
  rulerRuleType,
} from '../utils/rules';

import {
  type AbilityState,
  type AbilityStates,
  EnrichmentAction,
  ExternalRuleAction,
  FolderBulkAction,
  RuleAction,
} from './useAbilities.types';
import { useIsRuleEditable } from './useIsRuleEditable';

/**
 * These hooks determine if:
 *  1. the action is supported in the current context
 *  2. the user is allowed to perform the action based on their permissions / role
 *
 * All hooks return {@link AbilityState} — use `.granted` for the common yes/no check,
 * and `.supported` / `.allowed` when you need to distinguish "not available in this context"
 * from "no permission".
 */

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Constructs an {@link AbilityState} directly from a supported flag and a list of
 * AccessControlActions (user is allowed if they have ANY of the listed permissions).
 */
function toAbilityState(supported: boolean, loading: boolean, ...actions: AccessControlAction[]): AbilityState {
  const allowed = actions.some((action) => action && ctx.hasPermission(action));
  return { supported, allowed, loading, granted: !loading && supported && allowed };
}

/** Never-supported, never-allowed sentinel for actions that don't apply in the current context. */
const NeverGranted: AbilityState = { supported: false, allowed: false, loading: false, granted: false };

// ── Folder bulk action abilities ──────────────────────────────────────────────

export function useFolderBulkActionAbilityStates(): AbilityStates<FolderBulkAction> {
  const admin = isAdmin();
  // Memoised on admin flag — isAdmin() reads contextSrv which is a stable singleton,
  // but we still memoize to produce a stable object reference for consumers.
  return useMemo(
    () => ({
      [FolderBulkAction.Pause]: { supported: true, allowed: admin, loading: false, granted: admin },
      [FolderBulkAction.Delete]: { supported: true, allowed: admin, loading: false, granted: admin },
    }),
    [admin]
  );
}

export function useFolderBulkActionAbilityState(action: FolderBulkAction): AbilityState {
  const all = useFolderBulkActionAbilityStates();
  return useMemo(() => all[action], [all, action]);
}

// ── Grafana-managed rule abilities (global / list level) ──────────────────────

/**
 * Global Grafana rule abilities — checks whether the current user can perform
 * rule-level actions at the list/page level. Per-instance actions return NeverGranted
 * since they require a specific rule context.
 */
export function useRuleAbilityStates(): AbilityStates<RuleAction> {
  // Permissions are read from contextSrv on every call. We can't memoize based
  // on them without subscribing to contextSrv changes, so we produce a stable
  // object that only changes when the underlying permission values change.
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);
  const canRead = ctx.hasPermission(AccessControlAction.AlertingRuleRead);
  const canUpdate = ctx.hasPermission(AccessControlAction.AlertingRuleUpdate);
  const canDelete = ctx.hasPermission(AccessControlAction.AlertingRuleDelete);

  return useMemo<AbilityStates<RuleAction>>(
    () => ({
      [RuleAction.Create]: { supported: true, allowed: canCreate, loading: false, granted: canCreate },
      [RuleAction.View]: { supported: true, allowed: canRead, loading: false, granted: canRead },
      [RuleAction.Update]: { supported: true, allowed: canUpdate, loading: false, granted: canUpdate },
      [RuleAction.Delete]: { supported: true, allowed: canDelete, loading: false, granted: canDelete },
      [RuleAction.ExportRules]: { supported: true, allowed: canRead, loading: false, granted: canRead },
      // per-instance actions are not meaningful at list level
      [RuleAction.Duplicate]: NeverGranted,
      [RuleAction.Explore]: NeverGranted,
      [RuleAction.Silence]: NeverGranted,
      [RuleAction.ModifyExport]: NeverGranted,
      [RuleAction.Pause]: NeverGranted,
      [RuleAction.Restore]: NeverGranted,
      [RuleAction.DeletePermanently]: NeverGranted,
    }),
    [canCreate, canRead, canUpdate, canDelete]
  );
}

export function useRuleAbilityState(action: RuleAction): AbilityState {
  const all = useRuleAbilityStates();
  return useMemo(() => all[action], [all, action]);
}

// ── External datasource rule abilities (global / list level) ──────────────────

export function useExternalRuleAbilityStates(): AbilityStates<ExternalRuleAction> {
  const canWrite = ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite);
  const canRead = ctx.hasPermission(AccessControlAction.AlertingRuleExternalRead);

  return useMemo<AbilityStates<ExternalRuleAction>>(
    () => ({
      [ExternalRuleAction.CreateAlertRule]: { supported: true, allowed: canWrite, loading: false, granted: canWrite },
      [ExternalRuleAction.ViewAlertRule]: { supported: true, allowed: canRead, loading: false, granted: canRead },
      [ExternalRuleAction.UpdateAlertRule]: { supported: true, allowed: canWrite, loading: false, granted: canWrite },
      [ExternalRuleAction.DeleteAlertRule]: { supported: true, allowed: canWrite, loading: false, granted: canWrite },
    }),
    [canWrite, canRead]
  );
}

export function useExternalRuleAbilityState(action: ExternalRuleAction): AbilityState {
  const all = useExternalRuleAbilityStates();
  return useMemo(() => all[action], [all, action]);
}

// ── Enrichment abilities ──────────────────────────────────────────────────────

export function useEnrichmentAbilityStates(): AbilityStates<EnrichmentAction> {
  const userIsAdmin = isAdmin();
  const hasReadPermission = ctx.hasPermission(AccessControlAction.AlertingEnrichmentsRead);
  const hasWritePermission = ctx.hasPermission(AccessControlAction.AlertingEnrichmentsWrite);
  const supported = Boolean(config.featureToggles.alertEnrichment);

  return useMemo(() => {
    const readAllowed = userIsAdmin || hasReadPermission;
    const writeAllowed = userIsAdmin || hasWritePermission;
    return {
      [EnrichmentAction.Read]: {
        supported,
        allowed: readAllowed,
        loading: false,
        granted: supported && readAllowed,
      },
      [EnrichmentAction.Write]: {
        supported,
        allowed: writeAllowed,
        loading: false,
        granted: supported && writeAllowed,
      },
    };
  }, [userIsAdmin, hasReadPermission, hasWritePermission, supported]);
}

export function useEnrichmentAbilityState(action: EnrichmentAction): AbilityState {
  const all = useEnrichmentAbilityStates();
  return useMemo(() => all[action], [all, action]);
}

// ── Per-rule (RulerRule) abilities ────────────────────────────────────────────

export function useAllRulerRuleAbilityStates(
  rule: RulerRuleDTO | undefined,
  id: RuleGroupIdentifierV2
): AbilityStates<RuleAction> {
  const rulesSourceName = getGroupOriginName(id);
  const { isEditable, isRemovable, isRulerAvailable = false, loading } = useIsRuleEditable(rulesSourceName, rule);
  const { allowed: exportAllowed } = useRuleAbilityState(RuleAction.ExportRules);

  // useCanSilence returns stable primitives so they are safe as useMemo deps.
  const { silenceSupported, canSilenceInFolder, silenceLoading } = useCanSilence(rule);

  const pluginOrigin = getRulePluginOrigin(rule);
  const { data: pluginSettings, isLoading: pluginCheckLoading } = useGetPluginSettingsQuery(
    pluginOrigin?.pluginId ?? '',
    { skip: !pluginOrigin?.pluginId }
  );
  const isPluginInstalled = pluginSettings?.enabled ?? false;

  return useMemo<AbilityStates<RuleAction>>(() => {
    const isProvisioned = rule ? isProvisionedRule(rule) : false;
    // TODO: Add support for federated rules
    const isFederated = false;
    // Note: rulerRuleType.grafana.rule() returns true for ALL Grafana-managed rules
    // (both alerting and recording). Actions that apply only to alerting rules
    // (Pause, Restore, DeletePermanently) are further gated at the UI level.
    const isGrafanaManagedRule = rulerRuleType.grafana.rule(rule);

    const isPluginManaged = pluginOrigin ? pluginCheckLoading || isPluginInstalled : false;
    const immutableRule = isProvisioned || isFederated || isPluginManaged;

    const supported = loading ? false : isRulerAvailable;
    const supportedUnlessImmutable = immutableRule ? false : supported;
    const duplicateSupported = isPluginManaged ? false : supported;

    // Combined loading: either the rule editable check or the silence support check
    const combinedLoading = loading || silenceLoading;

    const rulesPermissions = getRulesPermissions(rulesSourceName);

    const mk = (s: boolean, a: boolean): AbilityState => ({
      supported: s,
      allowed: a,
      loading: combinedLoading,
      granted: !combinedLoading && s && a,
    });

    return {
      [RuleAction.Create]: NeverGranted,
      [RuleAction.View]: toAbilityState(true, combinedLoading, rulesPermissions.read),
      [RuleAction.Update]: mk(supportedUnlessImmutable, isEditable ?? false),
      [RuleAction.Delete]: mk(supportedUnlessImmutable, isRemovable ?? false),
      [RuleAction.ExportRules]: toAbilityState(true, combinedLoading, rulesPermissions.read),
      [RuleAction.Duplicate]: toAbilityState(duplicateSupported, combinedLoading, rulesPermissions.create),
      [RuleAction.Explore]: toAbilityState(true, combinedLoading, AccessControlAction.DataSourcesExplore),
      [RuleAction.Silence]: {
        supported: silenceSupported,
        allowed: canSilenceInFolder,
        loading: combinedLoading,
        granted: !combinedLoading && silenceSupported && canSilenceInFolder,
      },
      [RuleAction.ModifyExport]: mk(isGrafanaManagedRule, exportAllowed),
      [RuleAction.Pause]: mk(supportedUnlessImmutable && isGrafanaManagedRule, isEditable ?? false),
      [RuleAction.Restore]: mk(supportedUnlessImmutable && isGrafanaManagedRule, isEditable ?? false),
      [RuleAction.DeletePermanently]: mk(
        supportedUnlessImmutable && isGrafanaManagedRule,
        (isRemovable && isAdmin()) ?? false
      ),
    };
  }, [
    rule,
    loading,
    silenceLoading,
    isRulerAvailable,
    rulesSourceName,
    isEditable,
    isRemovable,
    silenceSupported,
    canSilenceInFolder,
    exportAllowed,
    pluginOrigin,
    pluginCheckLoading,
    isPluginInstalled,
  ]);
}

export function useRulerRuleAbilityState(
  rule: RulerRuleDTO | undefined,
  id: RuleGroupIdentifierV2,
  action: RuleAction
): AbilityState {
  const all = useAllRulerRuleAbilityStates(rule, id);
  return useMemo(() => all[action], [all, action]);
}

/**
 * Returns AbilityState for multiple RuleActions on the same RulerRule.
 *
 * IMPORTANT: callers should stabilize the `actions` array reference (e.g. via a
 * module-level constant or `useMemo`) so that this hook's inner `useMemo` is not
 * defeated by a new array reference on every render.
 */
export function useRulerRuleAbilityStates(
  rule: RulerRuleDTO | undefined,
  id: RuleGroupIdentifierV2,
  actions: RuleAction[]
): AbilityState[] {
  const all = useAllRulerRuleAbilityStates(rule, id);
  return useMemo(() => actions.map((a) => all[a]), [all, actions]);
}

// ── Per-rule (PromRule) abilities ─────────────────────────────────────────────

/**
 * Hook for checking abilities on Grafana Prometheus rules (GrafanaPromRuleDTO).
 * This is the preferred version for use with the rule list v2.
 */
export function useAllPromRuleAbilityStates(rule: GrafanaPromRuleDTO | undefined): AbilityStates<RuleAction> {
  const { isEditable, isRemovable, loading } = useIsGrafanaPromRuleEditable(rule);
  const { allowed: exportAllowed } = useRuleAbilityState(RuleAction.ExportRules);

  const { silenceSupported, silenceLoading } = useGrafanaRulesSilenceSupport();
  const canSilenceInFolder = useCanSilenceInFolder(rule?.folderUid);

  const promPluginOrigin = getRulePluginOrigin(rule);
  const { data: promPluginSettings, isLoading: promPluginCheckLoading } = useGetPluginSettingsQuery(
    promPluginOrigin?.pluginId ?? '',
    { skip: !promPluginOrigin?.pluginId }
  );
  const isPromPluginInstalled = promPluginSettings?.enabled ?? false;

  return useMemo<AbilityStates<RuleAction>>(() => {
    const isProvisioned = rule ? isProvisionedPromRule(rule) : false;
    const isFederated = false;
    const isAlertingRule = prometheusRuleType.grafana.alertingRule(rule);
    const isPluginProvided = Boolean(promPluginOrigin && (promPluginCheckLoading || isPromPluginInstalled));
    const immutableRule = isProvisioned || isFederated || isPluginProvided;

    const combinedLoading = loading || silenceLoading;

    const supported = combinedLoading ? false : true;
    const supportedUnlessImmutable = immutableRule ? false : supported;
    const duplicateSupported = isPluginProvided ? false : supported;

    const rulesPermissions = getRulesPermissions('grafana');

    const mk = (s: boolean, a: boolean): AbilityState => ({
      supported: s,
      allowed: a,
      loading: combinedLoading,
      granted: !combinedLoading && s && a,
    });

    return {
      [RuleAction.Create]: NeverGranted,
      [RuleAction.View]: toAbilityState(true, combinedLoading, rulesPermissions.read),
      [RuleAction.Update]: mk(supportedUnlessImmutable, isEditable ?? false),
      [RuleAction.Delete]: mk(supportedUnlessImmutable, isRemovable ?? false),
      [RuleAction.ExportRules]: toAbilityState(true, combinedLoading, rulesPermissions.read),
      [RuleAction.Duplicate]: toAbilityState(duplicateSupported, combinedLoading, rulesPermissions.create),
      [RuleAction.Explore]: toAbilityState(true, combinedLoading, AccessControlAction.DataSourcesExplore),
      [RuleAction.Silence]: mk(silenceSupported, canSilenceInFolder && isAlertingRule),
      [RuleAction.ModifyExport]: mk(isAlertingRule, exportAllowed),
      [RuleAction.Pause]: mk(supportedUnlessImmutable && isAlertingRule, isEditable ?? false),
      [RuleAction.Restore]: mk(supportedUnlessImmutable && isAlertingRule, isEditable ?? false),
      [RuleAction.DeletePermanently]: mk(
        supportedUnlessImmutable && isAlertingRule,
        (isRemovable && isAdmin()) ?? false
      ),
    };
  }, [
    rule,
    loading,
    silenceLoading,
    isEditable,
    isRemovable,
    canSilenceInFolder,
    exportAllowed,
    silenceSupported,
    promPluginOrigin,
    promPluginCheckLoading,
    isPromPluginInstalled,
  ]);
}

export const skipToken = Symbol('ability-skip-token');
type SkipToken = typeof skipToken;

export function usePromRuleAbilityState(rule: GrafanaPromRuleDTO | SkipToken, action: RuleAction): AbilityState {
  const all = useAllPromRuleAbilityStates(rule === skipToken ? undefined : rule);
  return useMemo(() => all[action], [all, action]);
}

/**
 * Returns AbilityState for multiple RuleActions on the same PromRule.
 *
 * IMPORTANT: callers should stabilize the `actions` array reference (e.g. via a
 * module-level constant or `useMemo`) so that this hook's inner `useMemo` is not
 * defeated by a new array reference on every render.
 */
export function usePromRuleAbilityStates(rule: GrafanaPromRuleDTO | SkipToken, actions: RuleAction[]): AbilityState[] {
  const all = useAllPromRuleAbilityStates(rule === skipToken ? undefined : rule);
  return useMemo(() => actions.map((a) => all[a]), [all, actions]);
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

/**
 * Returns silence support state as stable primitives (not a new array/object),
 * including a `loading` flag so callers can propagate it into AbilityState.
 */
function useGrafanaRulesSilenceSupport(): {
  silenceSupported: boolean;
  silenceLoading: boolean;
} {
  const { currentData: amConfigStatus, isLoading } = useGetGrafanaAlertingConfigurationStatusQuery(undefined);

  if (isLoading) {
    return { silenceSupported: false, silenceLoading: true };
  }

  const interactsOnlyWithExternalAMs = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.External;
  const interactsWithAll = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.All;
  const silenceSupported = !interactsOnlyWithExternalAMs || interactsWithAll;

  return { silenceSupported, silenceLoading: false };
}

/**
 * Returns stable silence primitives for the RulerRule path.
 * Folds the AM config loading into a `silenceLoading` boolean so the outer
 * `useMemo` in `useAllRulerRuleAbilityStates` can propagate it correctly.
 */
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

  return {
    silenceSupported,
    canSilenceInFolder: canSilenceInFolderValue,
    silenceLoading: amConfigLoading,
  };
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
