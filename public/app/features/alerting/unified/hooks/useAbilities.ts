import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { useFolder } from 'app/features/alerting/unified/hooks/useFolder';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import { type CombinedRule, type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { type GrafanaPromRuleDTO, type RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { useGetPluginSettingsQuery } from '../api/pluginsApi';
import { getRulesPermissions } from '../utils/access-control';
import { getGroupOriginName, groupIdentifier } from '../utils/groupIdentifier';
import { isAdmin } from '../utils/misc';
import {
  getRulePluginOrigin,
  isProvisionedPromRule,
  isProvisionedRule,
  prometheusRuleType,
  rulerRuleType,
} from '../utils/rules';

import {
  type Abilities,
  type Ability,
  EnrichmentAction,
  ExternalRuleAction,
  FolderBulkAction,
  RuleAction,
} from './useAbilities.types';
import { useIsRuleEditable } from './useIsRuleEditable';

/**
 * These hooks will determine if
 *  1. the action is supported in the current context (alertmanager, alert rule or general context)
 *  2. user is allowed to perform actions based on their set of permissions / assigned role
 */

// these just makes it easier to read the code :)
const AlwaysSupported = true;
const NotSupported = false;
const NeverSupported: Ability = [false, false];

// ── Folder bulk actions ───────────────────────────────────────────────────────

export const useFolderBulkActionAbilities = (): Abilities<FolderBulkAction> => {
  return {
    [FolderBulkAction.Pause]: [AlwaysSupported, isAdmin()],
    [FolderBulkAction.Delete]: [AlwaysSupported, isAdmin()],
  };
};

export const useFolderBulkActionAbility = (action: FolderBulkAction): Ability => {
  const allAbilities = useFolderBulkActionAbilities();
  return allAbilities[action];
};

// ── Grafana-managed rule abilities (global / list level) ──────────────────────

/**
 * Global Grafana rule abilities — checks whether the current user can perform
 * rule-level actions at the list/page level. Per-instance actions are set to
 * NeverSupported since they require a specific rule context.
 */
export const useRuleAbilities = (): Abilities<RuleAction> => {
  return {
    [RuleAction.Create]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleCreate),
    [RuleAction.View]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleRead),
    [RuleAction.Update]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleUpdate),
    [RuleAction.Delete]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleDelete),
    [RuleAction.ExportRules]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleRead),
    // per-instance actions are not meaningful at list level
    [RuleAction.Duplicate]: NeverSupported,
    [RuleAction.Explore]: NeverSupported,
    [RuleAction.Silence]: NeverSupported,
    [RuleAction.ModifyExport]: NeverSupported,
    [RuleAction.Pause]: NeverSupported,
    [RuleAction.Restore]: NeverSupported,
    [RuleAction.DeletePermanently]: NeverSupported,
  };
};

export const useRuleAbility = (action: RuleAction): Ability => {
  const allAbilities = useRuleAbilities();
  return allAbilities[action];
};

// ── External datasource rule abilities (global / list level) ──────────────────

export const useExternalRuleAbilities = (): Abilities<ExternalRuleAction> => {
  return {
    [ExternalRuleAction.CreateAlertRule]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleExternalWrite),
    [ExternalRuleAction.ViewAlertRule]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleExternalRead),
    [ExternalRuleAction.UpdateAlertRule]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleExternalWrite),
    [ExternalRuleAction.DeleteAlertRule]: toAbility(AlwaysSupported, AccessControlAction.AlertingRuleExternalWrite),
  };
};

export const useExternalRuleAbility = (action: ExternalRuleAction): Ability => {
  const allAbilities = useExternalRuleAbilities();
  return allAbilities[action];
};

// ── Enrichment abilities ──────────────────────────────────────────────────────

export const useEnrichmentAbilities = (): Abilities<EnrichmentAction> => {
  const userIsAdmin = isAdmin();
  const hasReadPermission = ctx.hasPermission(AccessControlAction.AlertingEnrichmentsRead);
  const hasWritePermission = ctx.hasPermission(AccessControlAction.AlertingEnrichmentsWrite);

  const enrichmentsSupported = Boolean(config.featureToggles.alertEnrichment);

  return {
    [EnrichmentAction.Read]: [enrichmentsSupported, userIsAdmin || hasReadPermission],
    [EnrichmentAction.Write]: [enrichmentsSupported, userIsAdmin || hasWritePermission],
  };
};

export const useEnrichmentAbility = (action: EnrichmentAction): Ability => {
  const allAbilities = useEnrichmentAbilities();
  return allAbilities[action];
};

// ── Per-rule instance abilities (Grafana-managed rules) ───────────────────────

/**
 * Check a single ability on a CombinedRule.
 * @deprecated Use {@link useRulerRuleAbility} instead
 */
export function useCombinedRuleAbility(rule: CombinedRule, action: RuleAction): Ability {
  const abilities = useAllCombinedRuleAbilities(rule);
  return useMemo(() => abilities[action], [abilities, action]);
}

/**
 * Check multiple abilities on a CombinedRule.
 * @deprecated Use {@link useRulerRuleAbilities} instead
 */
export function useCombinedRuleAbilities(rule: CombinedRule, actions: RuleAction[]): Ability[] {
  const abilities = useAllCombinedRuleAbilities(rule);
  return useMemo(() => actions.map((action) => abilities[action]), [abilities, actions]);
}

export function useRulerRuleAbility(
  rule: RulerRuleDTO | undefined,
  groupIdentifier: RuleGroupIdentifierV2,
  action: RuleAction
): Ability {
  const abilities = useAllRulerRuleAbilities(rule, groupIdentifier);
  return useMemo(() => abilities[action], [abilities, action]);
}

export function useRulerRuleAbilities(
  rule: RulerRuleDTO | undefined,
  groupIdentifier: RuleGroupIdentifierV2,
  actions: RuleAction[]
): Ability[] {
  const abilities = useAllRulerRuleAbilities(rule, groupIdentifier);
  return useMemo(() => actions.map((action) => abilities[action]), [abilities, actions]);
}

/**
 * @deprecated Use {@link useAllRulerRuleAbilities} instead
 */
export function useAllCombinedRuleAbilities(rule: CombinedRule): Abilities<RuleAction> {
  const groupIdentifierV2 = useMemo(() => groupIdentifier.fromCombinedRule(rule), [rule]);
  return useAllRulerRuleAbilities(rule.rulerRule, groupIdentifierV2);
}

export function useAllRulerRuleAbilities(
  rule: RulerRuleDTO | undefined,
  groupIdentifier: RuleGroupIdentifierV2
): Abilities<RuleAction> {
  const rulesSourceName = getGroupOriginName(groupIdentifier);

  const { isEditable, isRemovable, isRulerAvailable = false, loading } = useIsRuleEditable(rulesSourceName, rule);
  const [_, exportAllowed] = useRuleAbility(RuleAction.ExportRules);
  const canSilence = useCanSilence(rule);

  const pluginOrigin = getRulePluginOrigin(rule);
  const { data: pluginSettings, isLoading: pluginCheckLoading } = useGetPluginSettingsQuery(
    pluginOrigin?.pluginId ?? '',
    { skip: !pluginOrigin?.pluginId }
  );
  const isPluginInstalled = pluginSettings?.enabled ?? false;

  const abilities = useMemo<Abilities<RuleAction>>(() => {
    const isProvisioned = rule ? isProvisionedRule(rule) : false;
    // TODO: Add support for federated rules
    const isFederated = false;
    const isGrafanaManagedAlertRule = rulerRuleType.grafana.rule(rule);

    const isPluginManaged = pluginOrigin ? pluginCheckLoading || isPluginInstalled : false;
    const immutableRule = isProvisioned || isFederated || isPluginManaged;

    const MaybeSupported = loading ? NotSupported : isRulerAvailable;
    const MaybeSupportedUnlessImmutable = immutableRule ? NotSupported : MaybeSupported;
    const duplicateSupported = isPluginManaged ? NotSupported : MaybeSupported;

    const rulesPermissions = getRulesPermissions(rulesSourceName);

    return {
      // Create is not meaningful on an existing rule instance
      [RuleAction.Create]: NeverSupported,
      [RuleAction.View]: toAbility(AlwaysSupported, rulesPermissions.read),
      [RuleAction.Update]: [MaybeSupportedUnlessImmutable, isEditable ?? false],
      [RuleAction.Delete]: [MaybeSupportedUnlessImmutable, isRemovable ?? false],
      [RuleAction.ExportRules]: toAbility(AlwaysSupported, rulesPermissions.read),
      [RuleAction.Duplicate]: toAbility(duplicateSupported, rulesPermissions.create),
      [RuleAction.Explore]: toAbility(AlwaysSupported, AccessControlAction.DataSourcesExplore),
      [RuleAction.Silence]: canSilence,
      [RuleAction.ModifyExport]: [isGrafanaManagedAlertRule, exportAllowed],
      [RuleAction.Pause]: [MaybeSupportedUnlessImmutable && isGrafanaManagedAlertRule, isEditable ?? false],
      [RuleAction.Restore]: [MaybeSupportedUnlessImmutable && isGrafanaManagedAlertRule, isEditable ?? false],
      [RuleAction.DeletePermanently]: [
        MaybeSupportedUnlessImmutable && isGrafanaManagedAlertRule,
        (isRemovable && isAdmin()) ?? false,
      ],
    };
  }, [
    rule,
    loading,
    isRulerAvailable,
    rulesSourceName,
    isEditable,
    isRemovable,
    canSilence,
    exportAllowed,
    pluginOrigin,
    pluginCheckLoading,
    isPluginInstalled,
  ]);

  return abilities;
}

/**
 * Hook for checking abilities on Grafana Prometheus rules (GrafanaPromRuleDTO).
 * This is the preferred version for use with the rule list v2.
 */
export function useAllPromRuleAbilities(rule: GrafanaPromRuleDTO | undefined): Abilities<RuleAction> {
  const { isEditable, isRemovable, loading } = useIsGrafanaPromRuleEditable(rule);
  const [_, exportAllowed] = useRuleAbility(RuleAction.ExportRules);

  const silenceSupported = useGrafanaRulesSilenceSupport();
  const canSilenceInFolder = useCanSilenceInFolder(rule?.folderUid);

  const promPluginOrigin = getRulePluginOrigin(rule);
  const { data: promPluginSettings, isLoading: promPluginCheckLoading } = useGetPluginSettingsQuery(
    promPluginOrigin?.pluginId ?? '',
    { skip: !promPluginOrigin?.pluginId }
  );
  const isPromPluginInstalled = promPluginSettings?.enabled ?? false;

  const abilities = useMemo<Abilities<RuleAction>>(() => {
    const isProvisioned = rule ? isProvisionedPromRule(rule) : false;
    const isFederated = false;
    const isAlertingRule = prometheusRuleType.grafana.alertingRule(rule);
    const isPluginProvided = Boolean(promPluginOrigin && (promPluginCheckLoading || isPromPluginInstalled));
    const immutableRule = isProvisioned || isFederated || isPluginProvided;

    const MaybeSupported = loading ? NotSupported : AlwaysSupported;
    const MaybeSupportedUnlessImmutable = immutableRule ? NotSupported : MaybeSupported;
    const duplicateSupported = isPluginProvided ? NotSupported : MaybeSupported;

    const rulesPermissions = getRulesPermissions('grafana');

    return {
      // Create is not meaningful on an existing rule instance
      [RuleAction.Create]: NeverSupported,
      [RuleAction.View]: toAbility(AlwaysSupported, rulesPermissions.read),
      [RuleAction.Update]: [MaybeSupportedUnlessImmutable, isEditable ?? false],
      [RuleAction.Delete]: [MaybeSupportedUnlessImmutable, isRemovable ?? false],
      [RuleAction.ExportRules]: toAbility(AlwaysSupported, rulesPermissions.read),
      [RuleAction.Duplicate]: toAbility(duplicateSupported, rulesPermissions.create),
      [RuleAction.Explore]: toAbility(AlwaysSupported, AccessControlAction.DataSourcesExplore),
      [RuleAction.Silence]: [silenceSupported, canSilenceInFolder && isAlertingRule],
      [RuleAction.ModifyExport]: [isAlertingRule, exportAllowed],
      [RuleAction.Pause]: [MaybeSupportedUnlessImmutable && isAlertingRule, isEditable ?? false],
      [RuleAction.Restore]: [MaybeSupportedUnlessImmutable && isAlertingRule, isEditable ?? false],
      [RuleAction.DeletePermanently]: [
        MaybeSupportedUnlessImmutable && isAlertingRule,
        (isRemovable && isAdmin()) ?? false,
      ],
    };
  }, [
    rule,
    loading,
    isEditable,
    isRemovable,
    canSilenceInFolder,
    exportAllowed,
    silenceSupported,
    promPluginOrigin,
    promPluginCheckLoading,
    isPromPluginInstalled,
  ]);

  return abilities;
}

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

export const skipToken = Symbol('ability-skip-token');
type SkipToken = typeof skipToken;

export function usePromRuleAbility(rule: GrafanaPromRuleDTO | SkipToken, action: RuleAction): Ability {
  const abilities = useAllPromRuleAbilities(rule === skipToken ? undefined : rule);
  return useMemo(() => abilities[action], [abilities, action]);
}

export function usePromRuleAbilities(rule: GrafanaPromRuleDTO | SkipToken, actions: RuleAction[]): Ability[] {
  const abilities = useAllPromRuleAbilities(rule === skipToken ? undefined : rule);
  return useMemo(() => actions.map((action) => abilities[action]), [abilities, actions]);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const { useGetGrafanaAlertingConfigurationStatusQuery } = alertmanagerApi;

function useCanSilence(rule?: RulerRuleDTO): [boolean, boolean] {
  const folderUID = rulerRuleType.grafana.rule(rule) ? rule.grafana_alert.namespace_uid : undefined;
  const { loading: folderIsLoading, folder } = useFolder(folderUID);

  const isGrafanaManagedRule = rule && rulerRuleType.grafana.rule(rule);
  const isGrafanaRecording = rulerRuleType.grafana.recordingRule(rule);

  const silenceSupported = useGrafanaRulesSilenceSupport();
  const canSilenceInFolder = useCanSilenceInFolder(folderUID);

  if (!rule) {
    return [false, false];
  }

  if (!isGrafanaManagedRule || isGrafanaRecording || folderIsLoading || !folder) {
    return [false, false];
  }

  return [silenceSupported, canSilenceInFolder];
}

function useCanSilenceInFolder(folderUID?: string) {
  const folderPermissions = useFolderPermissions(folderUID);

  const hasFolderSilencePermission = folderPermissions[AccessControlAction.AlertingSilenceCreate] ?? false;
  const hasGlobalSilencePermission = ctx.hasPermission(AccessControlAction.AlertingInstanceCreate);

  return hasGlobalSilencePermission || hasFolderSilencePermission;
}

function useGrafanaRulesSilenceSupport() {
  const { currentData: amConfigStatus, isLoading } = useGetGrafanaAlertingConfigurationStatusQuery(undefined);

  const interactsOnlyWithExternalAMs = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.External;
  const interactsWithAll = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.All;
  const silenceSupported = !interactsOnlyWithExternalAMs || interactsWithAll;

  return isLoading ? false : silenceSupported;
}

function useFolderPermissions(folderUID?: string): Record<string, boolean> {
  const { folder } = useFolder(folderUID);
  return folder?.accessControl ?? {};
}

const toAbility = (supported: boolean, ...actions: AccessControlAction[]): Ability => [
  supported,
  actions.some((action) => action && ctx.hasPermission(action)),
];
