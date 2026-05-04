/**
 * access-control.ts — Alerting RBAC permission helpers
 *
 * This file has two tiers:
 *
 * 1. **Pure data** (no side effects): static permission maps and source-type-aware
 *    getters (`getRulesPermissions`, `getInstancesPermissions`, `getNotificationsPermissions`).
 *    Safe to call at module load time or in non-React contexts.
 *
 * 2. **Ability-calling utilities**: functions that delegate to the central ability system
 *    (`evaluateAccess`, `getRulesAccess`, `getCreateAlertInMenuAvailability`). These are
 *    intentionally plain functions (not hooks) because they are also used in non-React
 *    contexts (route guards, panel menus). When used inside React components, wrap them
 *    in `useMemo` or call them via the `useRulesAccess()` hook in `accessControlHooks.ts`.
 */

import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getExternalGlobalRuleAbility, getGlobalRuleAbility } from '../hooks/abilities/rules/ruleAbilities';
import { ExternalRuleAction, RuleAction } from '../hooks/abilities/types';

type RulesSourceType = 'grafana' | 'external';

// ── Pure data: static permission maps ────────────────────────────────────────
// Maps each CRUD operation to the correct AccessControlAction for Grafana-managed
// vs. external datasource resources. No side effects; safe to import anywhere.
//
// Note: we deliberately do NOT import from './datasource' here to avoid the mutual
// import cycle (datasource.ts ↔ access-control.ts). The only thing we needed from
// datasource.ts was `isGrafanaRulesSource`, which is just `name === 'grafana'`.
const GRAFANA_SOURCE_NAME = 'grafana' as const;

function getRulesSourceType(alertManagerSourceName: string): RulesSourceType {
  return alertManagerSourceName === GRAFANA_SOURCE_NAME ? 'grafana' : 'external';
}

export const instancesPermissions = {
  read: {
    grafana: AccessControlAction.AlertingInstanceRead,
    external: AccessControlAction.AlertingInstancesExternalRead,
  },
  create: {
    grafana: AccessControlAction.AlertingInstanceCreate,
    external: AccessControlAction.AlertingInstancesExternalWrite,
  },
  update: {
    grafana: AccessControlAction.AlertingInstanceUpdate,
    external: AccessControlAction.AlertingInstancesExternalWrite,
  },
  delete: {
    grafana: AccessControlAction.AlertingInstanceUpdate,
    external: AccessControlAction.AlertingInstancesExternalWrite,
  },
};

export const notificationsPermissions = {
  read: {
    grafana: AccessControlAction.AlertingNotificationsRead,
    external: AccessControlAction.AlertingNotificationsExternalRead,
  },
  create: {
    grafana: AccessControlAction.AlertingNotificationsWrite,
    external: AccessControlAction.AlertingNotificationsExternalWrite,
  },
  update: {
    grafana: AccessControlAction.AlertingNotificationsWrite,
    external: AccessControlAction.AlertingNotificationsExternalWrite,
  },
  delete: {
    grafana: AccessControlAction.AlertingNotificationsWrite,
    external: AccessControlAction.AlertingNotificationsExternalWrite,
  },
};

export const silencesPermissions = {
  read: {
    grafana: AccessControlAction.AlertingSilenceRead,
    external: AccessControlAction.AlertingInstanceRead,
  },
  create: {
    grafana: AccessControlAction.AlertingSilenceCreate,
    external: AccessControlAction.AlertingInstancesExternalWrite,
  },
  update: {
    grafana: AccessControlAction.AlertingSilenceUpdate,
    external: AccessControlAction.AlertingInstancesExternalWrite,
  },
};

export const provisioningPermissions = {
  read: AccessControlAction.AlertingProvisioningRead,
  readSecrets: AccessControlAction.AlertingProvisioningReadSecrets,
  write: AccessControlAction.AlertingProvisioningWrite,
};

const rulesPermissions = {
  read: {
    grafana: AccessControlAction.AlertingRuleRead,
    external: AccessControlAction.AlertingRuleExternalRead,
  },
  create: {
    grafana: AccessControlAction.AlertingRuleCreate,
    external: AccessControlAction.AlertingRuleExternalWrite,
  },
  update: {
    grafana: AccessControlAction.AlertingRuleUpdate,
    external: AccessControlAction.AlertingRuleExternalWrite,
  },
  delete: {
    grafana: AccessControlAction.AlertingRuleDelete,
    external: AccessControlAction.AlertingRuleExternalWrite,
  },
};

// ── Pure functions: source-type-aware permission resolvers ────────────────────
// Accept a rulesSourceName and return the correct AccessControlAction set for
// that source. No side effects; safe to call at any time.

export function getInstancesPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

  return {
    read: instancesPermissions.read[sourceType],
    create: instancesPermissions.create[sourceType],
    update: instancesPermissions.update[sourceType],
    delete: instancesPermissions.delete[sourceType],
  };
}

export function getNotificationsPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

  return {
    read: notificationsPermissions.read[sourceType],
    create: notificationsPermissions.create[sourceType],
    update: notificationsPermissions.update[sourceType],
    delete: notificationsPermissions.delete[sourceType],
    provisioning: provisioningPermissions,
  };
}

export function getRulesPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

  return {
    read: rulesPermissions.read[sourceType],
    create: rulesPermissions.create[sourceType],
    update: rulesPermissions.update[sourceType],
    delete: rulesPermissions.delete[sourceType],
  };
}

// ── Runtime utilities ─────────────────────────────────────────────────────────
// Plain functions (not hooks) for non-React contexts (route guards, panel menus).
// RBAC checks delegate to get*Ability() from the central ability system.
// evaluateAccess uses contextSrv.evaluatePermission directly (route-guard API).
// getRulesAccess retains direct contextSrv calls only for the auxiliary
// FoldersRead / DataSourcesRead workflow-feasibility guards.

/**
 * Returns a route-guard thunk for Grafana's route config.
 * The returned function is called at navigation time to check if the user can
 * access the route.
 */
export function evaluateAccess(actions: AccessControlAction[]) {
  return () => {
    return contextSrv.evaluatePermission(actions);
  };
}

/**
 * Returns an object describing what rule-creation actions the current user can
 * perform globally.  Inside React components use `useRulesAccess()` from
 * `accessControlHooks.ts` instead.
 *
 * Note: `canCreateGrafanaRules` and `canCreateCloudRules` add workflow-feasibility
 * guards (FoldersRead, DataSourcesRead) on top of the RBAC check — callers need both
 * the permission AND a folder/datasource to be visible. The RBAC portion is delegated
 * to the central ability system; the auxiliary guards remain here.
 */
export function getRulesAccess() {
  return {
    canCreateGrafanaRules:
      contextSrv.hasPermission(AccessControlAction.FoldersRead) && getGlobalRuleAbility(RuleAction.Create).granted,
    canCreateCloudRules:
      contextSrv.hasPermission(AccessControlAction.DataSourcesRead) &&
      getExternalGlobalRuleAbility(ExternalRuleAction.CreateAlertRule).granted,
    canEditRules: (rulesSourceName: string) => {
      return rulesSourceName === GRAFANA_SOURCE_NAME
        ? getGlobalRuleAbility(RuleAction.Update).granted
        : getExternalGlobalRuleAbility(ExternalRuleAction.UpdateAlertRule).granted;
    },
  };
}

/**
 * Returns whether the "Create alert rule" option should appear in panel menus.
 * Called in non-React panel-menu utilities; not a hook.
 */
export function getCreateAlertInMenuAvailability() {
  const { unifiedAlertingEnabled } = getConfig();
  const canRead = getGlobalRuleAbility(RuleAction.View).granted;
  const canUpdate = getGlobalRuleAbility(RuleAction.Update).granted;

  return unifiedAlertingEnabled && canRead && canUpdate;
}
