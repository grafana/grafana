import { useMemo } from 'react';

import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { CombinedRule, RulesSource } from 'app/types/unified-alerting';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { useAlertmanager } from '../state/AlertmanagerContext';
import { getInstancesPermissions, getNotificationsPermissions, getRulesPermissions } from '../utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../utils/rules';

import { useIsRuleEditable } from './useIsRuleEditable';

/**
 * These hooks will determine if
 *  1. the action is supported in the current alertmanager or data source context
 *  2. user is allowed to perform actions based on their set of permissions / assigned role
 */
export enum AlertmanagerAction {
  // configuration
  ViewExternalConfiguration = 'view-external-configuration',
  UpdateExternalConfiguration = 'update-external-configuration',

  // contact points
  CreateContactPoint = 'create-contact-point',
  ViewContactPoint = 'view-contact-point',
  UpdateContactPoint = 'edit-contact-points',
  DeleteContactPoint = 'delete-contact-point',
  ExportContactPoint = 'export-contact-point',

  // notification templates
  CreateNotificationTemplate = 'create-notification-template',
  ViewNotificationTemplate = 'view-notification-template',
  UpdateNotificationTemplate = 'edit-notification-template',
  DeleteNotificationTemplate = 'delete-notification-template',
  DecryptSecrets = 'decrypt-secrets',

  // notification policies
  CreateNotificationPolicy = 'create-notification-policy',
  ViewNotificationPolicyTree = 'view-notification-policy-tree',
  UpdateNotificationPolicyTree = 'update-notification-policy-tree',
  DeleteNotificationPolicy = 'delete-notification-policy',
  ExportNotificationPolicies = 'export-notification-policies',

  // silences – these cannot be deleted only "expired" (updated)
  CreateSilence = 'create-silence',
  ViewSilence = 'view-silence',
  UpdateSilence = 'update-silence',

  // mute timings
  ViewMuteTiming = 'view-mute-timing',
  CreateMuteTiming = 'create-mute-timing',
  UpdateMuteTiming = 'update-mute-timing',
  DeleteMuteTiming = 'delete-mute-timing',
}

export enum AlertRuleAction {
  CreateAlertRule = 'create-alert-rule',
  DuplicateAlertRule = 'duplicate-alert-rule',
  ViewAlertRule = 'view-alert-rule',
  UpdateAlertRule = 'update-alert-rule',
  DeleteAlertRule = 'delete-alert-rule',
  ExploreRule = 'explore-alert-rule',
  SilenceAlertRule = 'SilenceAlertRule',
}

export enum AlertingAction {
  // internal (Grafana managed)
  CreateAlertRule = 'create-alert-rule',
  ViewAlertRule = 'view-alert-rule',
  UpdateAlertRule = 'update-alert-rule',
  DeleteAlertRule = 'delete-alert-rule',
  ExportGrafanaManagedRules = 'export-grafana-managed-rules',
  // external (any compatible alerting data source)
  CreateExternalAlertRule = 'create-external-alert-rule',
  ViewExternalAlertRule = 'view-external-alert-rule',
  UpdateExternalAlertRule = 'update-external-alert-rule',
  DeleteExternalAlertRule = 'delete-external-alert-rule',
}

const AlwaysSupported = true; // this just makes it easier to understand the code
const NotSupported = false;
export type Action = AlertmanagerAction | AlertingAction | AlertRuleAction;

export type Ability = [actionSupported: boolean, actionAllowed: boolean];
export type Abilities<T extends Action> = Record<T, Ability>;

/**
 * This one will check for alerting abilities that don't apply to any particular alert source or alert rule
 */
export const useAlertingAbilities = (): Abilities<AlertingAction> => {
  return {
    // internal (Grafana managed)
    [AlertingAction.CreateAlertRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.AlertingRuleCreate)],
    [AlertingAction.ViewAlertRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.AlertingRuleRead)],
    [AlertingAction.UpdateAlertRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.AlertingRuleUpdate)],
    [AlertingAction.DeleteAlertRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.AlertingRuleDelete)],
    [AlertingAction.ExportGrafanaManagedRules]: [
      AlwaysSupported,
      ctx.hasPermission(AccessControlAction.AlertingProvisioningRead) ||
        ctx.hasPermission(AccessControlAction.AlertingProvisioningReadSecrets),
    ],
    // external
    [AlertingAction.CreateExternalAlertRule]: [
      AlwaysSupported,
      ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
    ],
    [AlertingAction.ViewExternalAlertRule]: [
      AlwaysSupported,
      ctx.hasPermission(AccessControlAction.AlertingRuleExternalRead),
    ],
    [AlertingAction.UpdateExternalAlertRule]: [
      AlwaysSupported,
      ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
    ],
    [AlertingAction.DeleteExternalAlertRule]: [
      AlwaysSupported,
      ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
    ],
  };
};

export const useAlertingAbility = (action: AlertingAction): Ability => {
  const allAbilities = useAlertingAbilities();
  return allAbilities[action];
};

/**
 * This hook will check if we support the action and have sufficient permissions for it on a single alert rule
 */
export function useAlertRuleAbility(rule: CombinedRule, action: AlertRuleAction): Ability {
  const abilities = useAllAlertRuleAbilities(rule);

  return useMemo(() => {
    return abilities[action];
  }, [abilities, action]);
}

export function useAllAlertRuleAbilities(rule: CombinedRule): Abilities<AlertRuleAction> {
  const rulesSource = rule.namespace.rulesSource;
  const rulesSourceName = typeof rulesSource === 'string' ? rulesSource : rulesSource.name;

  const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);
  const isFederated = isFederatedRuleGroup(rule.group);

  // if a rule is either provisioned or a federated rule, we don't allow it to be removed or edited
  const immutableRule = isProvisioned || isFederated;

  // TODO refactor this hook maybe
  const { isEditable, isRemovable, loading } = useIsRuleEditable(rulesSourceName, rule.rulerRule);
  const MaybeSupported = immutableRule ? NotSupported : loading ? NotSupported : AlwaysSupported; // while we gather info, pretend it's not supported

  const rulesPermissions = getRulesPermissions(rulesSourceName);
  const canSilence = useCanSilence(rulesSource);

  // TODO check if alert source supports actions!
  const abilities: Abilities<AlertRuleAction> = {
    [AlertRuleAction.CreateAlertRule]: [AlwaysSupported, ctx.hasPermission(rulesPermissions.create)],
    [AlertRuleAction.DuplicateAlertRule]: [AlwaysSupported, ctx.hasPermission(rulesPermissions.create)],
    [AlertRuleAction.ViewAlertRule]: [AlwaysSupported, ctx.hasPermission(rulesPermissions.read)],
    [AlertRuleAction.UpdateAlertRule]: [MaybeSupported, isEditable ?? false],
    [AlertRuleAction.DeleteAlertRule]: [MaybeSupported, isRemovable ?? false],
    [AlertRuleAction.ExploreRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.DataSourcesExplore)],
    [AlertRuleAction.SilenceAlertRule]: canSilence,
  };

  return abilities;
}

export function useAllAlertmanagerAbilities(): Abilities<AlertmanagerAction> {
  const {
    selectedAlertmanager,
    hasConfigurationAPI,
    isGrafanaAlertmanager: isGrafanaFlavoredAlertmanager,
  } = useAlertmanager();

  // These are used for interacting with Alertmanager resources where we apply alert.notifications:<name> permissions.
  // There are different permissions based on wether the built-in alertmanager is selected (grafana) or an external one.
  const notificationsPermissions = getNotificationsPermissions(selectedAlertmanager!);
  const instancePermissions = getInstancesPermissions(selectedAlertmanager!);

  // list out all of the abilities, and if the user has permissions to perform them
  const abilities: Abilities<AlertmanagerAction> = {
    // -- configuration --
    [AlertmanagerAction.ViewExternalConfiguration]: [
      AlwaysSupported,
      ctx.hasPermission(AccessControlAction.AlertingNotificationsExternalRead),
    ],
    [AlertmanagerAction.UpdateExternalConfiguration]: [
      hasConfigurationAPI,
      ctx.hasPermission(AccessControlAction.AlertingNotificationsExternalWrite),
    ],
    // -- contact points --
    [AlertmanagerAction.CreateContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.create)],
    [AlertmanagerAction.ViewContactPoint]: [AlwaysSupported, ctx.hasPermission(notificationsPermissions.read)],
    [AlertmanagerAction.UpdateContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.update)],
    [AlertmanagerAction.DeleteContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.delete)],
    // only Grafana flavored alertmanager supports exporting
    [AlertmanagerAction.ExportContactPoint]: [
      isGrafanaFlavoredAlertmanager,
      ctx.hasPermission(notificationsPermissions.read),
    ],
    // -- notification templates --
    [AlertmanagerAction.CreateNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.create),
    ],
    [AlertmanagerAction.ViewNotificationTemplate]: [AlwaysSupported, ctx.hasPermission(notificationsPermissions.read)],
    [AlertmanagerAction.UpdateNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.update),
    ],
    [AlertmanagerAction.DeleteNotificationTemplate]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.delete),
    ],
    // -- notification policies --
    [AlertmanagerAction.CreateNotificationPolicy]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.create),
    ],
    [AlertmanagerAction.ViewNotificationPolicyTree]: [
      AlwaysSupported,
      ctx.hasPermission(notificationsPermissions.read),
    ],
    [AlertmanagerAction.UpdateNotificationPolicyTree]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.update),
    ],
    [AlertmanagerAction.DeleteNotificationPolicy]: [
      hasConfigurationAPI,
      ctx.hasPermission(notificationsPermissions.delete),
    ],
    [AlertmanagerAction.ExportNotificationPolicies]: [
      isGrafanaFlavoredAlertmanager,
      ctx.hasPermission(notificationsPermissions.read),
    ],
    [AlertmanagerAction.DecryptSecrets]: [
      isGrafanaFlavoredAlertmanager,
      ctx.hasPermission(notificationsPermissions.provisioning.readSecrets),
    ],
    // -- silences --
    [AlertmanagerAction.CreateSilence]: [hasConfigurationAPI, ctx.hasPermission(instancePermissions.create)],
    [AlertmanagerAction.ViewSilence]: [AlwaysSupported, ctx.hasPermission(instancePermissions.read)],
    [AlertmanagerAction.UpdateSilence]: [hasConfigurationAPI, ctx.hasPermission(instancePermissions.update)],
    // -- mute timtings --
    [AlertmanagerAction.CreateMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.create)],
    [AlertmanagerAction.ViewMuteTiming]: [AlwaysSupported, ctx.hasPermission(notificationsPermissions.read)],
    [AlertmanagerAction.UpdateMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.update)],
    [AlertmanagerAction.DeleteMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.delete)],
  };

  return abilities;
}

export function useAlertmanagerAbility(action: AlertmanagerAction): Ability {
  const abilities = useAllAlertmanagerAbilities();

  return useMemo(() => {
    return abilities[action];
  }, [abilities, action]);
}

export function useAlertmanagerAbilities(actions: AlertmanagerAction[]): Ability[] {
  const abilities = useAllAlertmanagerAbilities();

  return useMemo(() => {
    return actions.map((action) => abilities[action]);
  }, [abilities, actions]);
}

/**
 * We don't want to show the silence button if either
 * 1. the user has no permissions to create silences
 * 2. the admin has configured to only send instances to external AMs
 */
export function useCanSilence(rulesSource: RulesSource): [boolean, boolean] {
  const isGrafanaManagedRule = rulesSource === GRAFANA_RULES_SOURCE_NAME;

  const { useGetAlertmanagerChoiceStatusQuery } = alertmanagerApi;
  const { currentData: amConfigStatus, isLoading } = useGetAlertmanagerChoiceStatusQuery(undefined, {
    skip: !isGrafanaManagedRule,
  });

  // we don't support silencing when the rule is not a Grafana managed rule
  // we simply don't know what Alertmanager the ruler is sending alerts to
  if (!isGrafanaManagedRule || isLoading) {
    return [false, false];
  }

  const hasPermissions = ctx.hasPermission(AccessControlAction.AlertingInstanceCreate);

  const interactsOnlyWithExternalAMs = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.External;
  const interactsWithAll = amConfigStatus?.alertmanagersChoice === AlertmanagerChoice.All;
  const silenceSupported = !interactsOnlyWithExternalAMs || interactsWithAll;

  return [silenceSupported, hasPermissions];
}
