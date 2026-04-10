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
  type AbilityState,
  type AbilityStates,
  ExternalRuleAction,
  Granted,
  Immutable,
  InsufficientPermissions,
  Loading,
  NotSupported,
  RuleAction,
} from './types';

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Builds the AbilityState for a silence action from the three conditions that
 * determine it. Extracted to avoid repeating the same if-chain in both the
 * Ruler and Prom rule paths.
 */
function buildSilenceAbility(loading: boolean, supported: boolean, canSilence: boolean): AbilityState {
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

function fromPermissions(
  supported: boolean,
  loading: boolean,
  ...anyOfPermissions: AccessControlAction[]
): AbilityState {
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

export function useRuleAbilityStates(): AbilityStates<RuleAction> {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);
  const canRead = ctx.hasPermission(AccessControlAction.AlertingRuleRead);
  const canUpdate = ctx.hasPermission(AccessControlAction.AlertingRuleUpdate);
  const canDelete = ctx.hasPermission(AccessControlAction.AlertingRuleDelete);

  return useMemo<AbilityStates<RuleAction>>(
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

export function useExternalRuleAbilityState(action: ExternalRuleAction): AbilityState {
  const all = useExternalRuleAbilityStates();
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

// ── Per-rule edit ability (Ruler path) ────────────────────────────────────────

interface RuleEditAbilityResult {
  update: AbilityState;
  delete: AbilityState;
  isPluginManaged: boolean;
  loading: boolean;
}

/**
 * Combines editability and immutability into per-action AbilityState values.
 * Priority: LOADING > NOT_SUPPORTED (ruler unavailable) > IMMUTABLE > INSUFFICIENT_PERMISSIONS.
 */
export function useRuleEditAbility(rule: RulerRuleDTO | undefined, id: RuleGroupIdentifierV2): RuleEditAbilityResult {
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
    const immutableRule = isProvisioned || isFederated || isPluginManaged;
    const loading = editableLoading || pluginLoading;
    const rulesPermissions = getRulesPermissions(rulesSourceName);

    function compute(hasPermission: boolean, permission: AccessControlAction): AbilityState {
      if (loading) {
        return Loading;
      }
      if (!isRulerAvailable) {
        return NotSupported;
      }
      if (immutableRule) {
        return Immutable;
      }
      if (!hasPermission) {
        return InsufficientPermissions([permission]);
      }
      return Granted;
    }

    return {
      update: compute(isEditable ?? false, rulesPermissions.update),
      delete: compute(isRemovable ?? false, rulesPermissions.delete),
      isPluginManaged,
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

// ── Per-rule (RulerRule) abilities ────────────────────────────────────────────

export function useAllRulerRuleAbilityStates(
  rule: RulerRuleDTO | undefined,
  id: RuleGroupIdentifierV2
): AbilityStates<RuleAction> {
  const rulesSourceName = getGroupOriginName(id);
  const {
    update: updateAbility,
    delete: deleteAbility,
    isPluginManaged,
    loading: editLoading,
  } = useRuleEditAbility(rule, id);
  const exportAbility = useRuleAbilityState(RuleAction.ExportRules);
  const { silenceSupported, canSilenceInFolder, silenceLoading } = useCanSilence(rule);

  return useMemo<AbilityStates<RuleAction>>(() => {
    const combinedLoading = editLoading || silenceLoading;
    const isGrafanaManagedRule = rulerRuleType.grafana.rule(rule);
    const rulesPermissions = getRulesPermissions(rulesSourceName);

    const silenceAbility = buildSilenceAbility(silenceLoading, silenceSupported, canSilenceInFolder);

    const grafanaOnlyUpdate: AbilityState = isGrafanaManagedRule ? updateAbility : NotSupported;

    const deletePermanentlyAbility: AbilityState = (() => {
      if (!isGrafanaManagedRule) {
        return NotSupported;
      }

      if (!deleteAbility.granted) {
        return deleteAbility;
      }

      if (!isAdmin()) {
        return InsufficientPermissions([rulesPermissions.delete]);
      }

      return Granted;
    })();

    const duplicateAbility: AbilityState = (() => {
      if (editLoading) {
        return Loading;
      }
      if (isPluginManaged) {
        return NotSupported;
      }
      return fromPermissions(true, false, rulesPermissions.create);
    })();

    return {
      [RuleAction.Create]: NotSupported,
      [RuleAction.View]: fromPermissions(true, combinedLoading, rulesPermissions.read),
      [RuleAction.Update]: updateAbility,
      [RuleAction.Delete]: deleteAbility,
      [RuleAction.ExportRules]: fromPermissions(true, combinedLoading, rulesPermissions.read),
      [RuleAction.Duplicate]: duplicateAbility,
      [RuleAction.Explore]: fromPermissions(true, combinedLoading, AccessControlAction.DataSourcesExplore),
      [RuleAction.Silence]: silenceAbility,
      [RuleAction.ModifyExport]: isGrafanaManagedRule ? exportAbility : NotSupported,
      [RuleAction.Pause]: grafanaOnlyUpdate,
      [RuleAction.Restore]: grafanaOnlyUpdate,
      [RuleAction.DeletePermanently]: deletePermanentlyAbility,
    };
  }, [
    rule,
    rulesSourceName,
    updateAbility,
    deleteAbility,
    exportAbility,
    isPluginManaged,
    editLoading,
    silenceLoading,
    silenceSupported,
    canSilenceInFolder,
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

export function useAllPromRuleAbilityStates(rule: GrafanaPromRuleDTO | undefined): AbilityStates<RuleAction> {
  const { isEditable, isRemovable, loading: editableLoading } = useIsGrafanaPromRuleEditable(rule);
  const exportAbility = useRuleAbilityState(RuleAction.ExportRules);
  const { silenceSupported, silenceLoading } = useGrafanaRulesSilenceSupport();
  const canSilenceInFolder = useCanSilenceInFolder(rule?.folderUid);
  const { isPluginManaged, pluginLoading } = useRulePluginImmutability(rule);

  return useMemo<AbilityStates<RuleAction>>(() => {
    const isProvisioned = rule ? isProvisionedPromRule(rule) : false;
    const isFederated = false;
    const isAlertingRule = prometheusRuleType.grafana.alertingRule(rule);
    const immutableRule = isProvisioned || isFederated || isPluginManaged;
    const combinedLoading = editableLoading || silenceLoading || pluginLoading;

    const rulesPermissions = getRulesPermissions('grafana');

    function computeEdit(hasPermission: boolean, permission: AccessControlAction): AbilityState {
      if (combinedLoading) {
        return Loading;
      }

      if (immutableRule) {
        return Immutable;
      }

      if (!hasPermission) {
        return InsufficientPermissions([permission]);
      }

      return Granted;
    }

    const updateAbility = computeEdit(isEditable ?? false, rulesPermissions.update);
    const deleteAbility = computeEdit(isRemovable ?? false, rulesPermissions.delete);

    const silenceAbility = buildSilenceAbility(silenceLoading, silenceSupported, canSilenceInFolder && isAlertingRule);

    const alertingOnlyUpdate: AbilityState = isAlertingRule ? updateAbility : NotSupported;

    const deletePermanentlyAbility: AbilityState = (() => {
      if (!isAlertingRule) {
        return NotSupported;
      }
      if (!deleteAbility.granted) {
        return deleteAbility;
      }
      if (!isAdmin()) {
        return InsufficientPermissions([rulesPermissions.delete]);
      }
      return Granted;
    })();

    const duplicateAbility: AbilityState = (() => {
      if (combinedLoading) {
        return Loading;
      }
      if (isPluginManaged) {
        return NotSupported;
      }
      return fromPermissions(true, false, rulesPermissions.create);
    })();

    return {
      [RuleAction.Create]: NotSupported,
      [RuleAction.View]: fromPermissions(true, combinedLoading, rulesPermissions.read),
      [RuleAction.Update]: updateAbility,
      [RuleAction.Delete]: deleteAbility,
      [RuleAction.ExportRules]: fromPermissions(true, combinedLoading, rulesPermissions.read),
      [RuleAction.Duplicate]: duplicateAbility,
      [RuleAction.Explore]: fromPermissions(true, combinedLoading, AccessControlAction.DataSourcesExplore),
      [RuleAction.Silence]: silenceAbility,
      [RuleAction.ModifyExport]: isAlertingRule ? exportAbility : NotSupported,
      [RuleAction.Pause]: alertingOnlyUpdate,
      [RuleAction.Restore]: alertingOnlyUpdate,
      [RuleAction.DeletePermanently]: deletePermanentlyAbility,
    };
  }, [
    rule,
    editableLoading,
    silenceLoading,
    pluginLoading,
    isEditable,
    isRemovable,
    canSilenceInFolder,
    exportAbility,
    silenceSupported,
    isPluginManaged,
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
