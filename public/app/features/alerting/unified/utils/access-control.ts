/**
 * access-control.ts — Alerting RBAC permission helpers
 *
 * This file has two tiers:
 *
 * 1. **Pure data** (no side effects): static permission maps and source-type-aware
 *    getters (`getRulesPermissions`, `getInstancesPermissions`, `getNotificationsPermissions`).
 *    Safe to call at module load time or in non-React contexts.
 *
 * 2. **contextSrv-calling utilities**: functions that call `contextSrv.hasPermission` /
 *    `contextSrv.evaluatePermission` at call time (`evaluateAccess`, `getRulesAccess`,
 *    `getCreateAlertInMenuAvailability`). These are intentionally plain functions (not hooks)
 *    because they are also used in non-React contexts (route guards, panel menus).
 *    When used inside React components, wrap them in `useMemo` or call them via the
 *    `useRulesAccess()` hook in `accessControlHooks.ts`.
 */

import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource } from './datasource';

type RulesSourceType = 'grafana' | 'external';

// ── Pure data: static permission maps ────────────────────────────────────────
// Maps each CRUD operation to the correct AccessControlAction for Grafana-managed
// vs. external datasource resources. No side effects; safe to import anywhere.

function getRulesSourceType(alertManagerSourceName: string): RulesSourceType {
  return isGrafanaRulesSource(alertManagerSourceName) ? 'grafana' : 'external';
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

// ── contextSrv-calling utilities ─────────────────────────────────────────────
// These functions read permissions at call time via contextSrv. They are plain
// functions (not hooks) because they are also used in non-React contexts
// (route guards, panel menus). Inside React components prefer the wrappers in
// accessControlHooks.ts.

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
 */
export function getRulesAccess() {
  return {
    canCreateGrafanaRules:
      contextSrv.hasPermission(AccessControlAction.FoldersRead) &&
      contextSrv.hasPermission(rulesPermissions.create.grafana),
    canCreateCloudRules:
      contextSrv.hasPermission(AccessControlAction.DataSourcesRead) &&
      contextSrv.hasPermission(rulesPermissions.create.external),
    canEditRules: (rulesSourceName: string) => {
      return contextSrv.hasPermission(getRulesPermissions(rulesSourceName).update);
    },
  };
}

/**
 * Returns whether the "Create alert rule" option should appear in panel menus.
 * Called in non-React panel-menu utilities; not a hook.
 */
export function getCreateAlertInMenuAvailability() {
  const { unifiedAlertingEnabled } = getConfig();
  const hasRuleReadPermissions = contextSrv.hasPermission(getRulesPermissions(GRAFANA_RULES_SOURCE_NAME).read);
  const hasRuleUpdatePermissions = contextSrv.hasPermission(getRulesPermissions(GRAFANA_RULES_SOURCE_NAME).update);
  const isAlertingAvailableForRead = unifiedAlertingEnabled && hasRuleReadPermissions;

  return isAlertingAvailableForRead && hasRuleUpdatePermissions;
}
