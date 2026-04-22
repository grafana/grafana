/**
 * ruleAbilities.ts — unscoped (global / list-level) rule RBAC ability checks
 *
 * Each domain exposes two public APIs that share identical action→permission logic:
 *
 *   get*(action)  — pure sync function, safe to call outside React (route guards,
 *                   panel menus, module init). Reads permissions from contextSrv and
 *                   returns an `Ability` immediately. No useMemo, no hook rules.
 *
 *   use*(action)  — React hook. Wraps the corresponding get* function in useMemo.
 *                   contextSrv permissions are stable for the session (not reactive
 *                   state), so an empty or action-keyed deps array is correct.
 *
 * Both forms return `Ability` (never `AsyncAbility`) — these checks are fully
 * synchronous with no folder-scoped or plugin-settings dependencies.
 *
 * For per-rule (entity-scoped, async) ability checks see rulerRuleAbilities.ts /
 * promRuleAbilities.ts.
 */

import { useMemo } from 'react';

import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { makeAbility } from '../abilityUtils';
import {
  type Abilities,
  type Ability,
  ExternalRuleAction,
  Granted,
  InsufficientPermissions,
  NotSupported,
  RuleAction,
} from '../types';

// ── Grafana-managed rule abilities (global / list level) ──────────────────────

/**
 * Returns all global Grafana-managed rule abilities.
 * Single source of truth for every `RuleAction → Ability` mapping.
 * Safe to call outside React.
 */
export function getGlobalRuleAbilities(): Abilities<RuleAction> {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);
  const canRead = ctx.hasPermission(AccessControlAction.AlertingRuleRead);
  const canUpdate = ctx.hasPermission(AccessControlAction.AlertingRuleUpdate);
  const canDelete = ctx.hasPermission(AccessControlAction.AlertingRuleDelete);
  // Import requires BOTH create and provisioning-set-status (AND logic).
  // anyOfPermissions lists both so the tooltip shows everything that's needed.
  const canProvisioningSetStatus = ctx.hasPermission(AccessControlAction.AlertingProvisioningSetStatus);

  return {
    [RuleAction.Create]: canCreate ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleCreate]),
    [RuleAction.View]: canRead ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleRead]),
    [RuleAction.Update]: canUpdate ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleUpdate]),
    [RuleAction.Delete]: canDelete ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleDelete]),
    [RuleAction.ExportRules]: canRead ? Granted : InsufficientPermissions([AccessControlAction.AlertingRuleRead]),
    [RuleAction.Import]:
      canCreate && canProvisioningSetStatus
        ? Granted
        : InsufficientPermissions([
            AccessControlAction.AlertingRuleCreate,
            AccessControlAction.AlertingProvisioningSetStatus,
          ]),
    // per-instance actions are not meaningful at list level
    [RuleAction.Duplicate]: NotSupported,
    [RuleAction.Explore]: NotSupported,
    [RuleAction.Silence]: NotSupported,
    [RuleAction.ModifyExport]: NotSupported,
    [RuleAction.Pause]: NotSupported,
    [RuleAction.Restore]: NotSupported,
    [RuleAction.DeletePermanently]: NotSupported,
  };
}

/**
 * Returns the `Ability` for a single global Grafana-managed rule action.
 * Safe to call outside React.
 */
export function getGlobalRuleAbility(action: RuleAction): Ability {
  return getGlobalRuleAbilities()[action];
}

/** React hook. Returns all global Grafana-managed rule abilities, memoized. */
export function useGlobalRuleAbilities(): Abilities<RuleAction> {
  return useMemo(getGlobalRuleAbilities, []);
}

/** React hook. Returns the `Ability` for a single global Grafana-managed rule action. */
export function useGlobalRuleAbility(action: RuleAction): Ability {
  return useMemo(() => getGlobalRuleAbility(action), [action]);
}

// ── External datasource rule abilities (global / list level) ──────────────────

/**
 * Returns all global external datasource rule abilities.
 * Single source of truth for every `ExternalRuleAction → Ability` mapping.
 * Safe to call outside React.
 */
export function getExternalGlobalRuleAbilities(): Abilities<ExternalRuleAction> {
  const canWrite = ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite);
  const canRead = ctx.hasPermission(AccessControlAction.AlertingRuleExternalRead);

  return {
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
  };
}

/**
 * Returns the `Ability` for a single global external datasource rule action.
 * Safe to call outside React.
 */
export function getExternalGlobalRuleAbility(action: ExternalRuleAction): Ability {
  return getExternalGlobalRuleAbilities()[action];
}

/** React hook. Returns all global external datasource rule abilities, memoized. */
export function useExternalGlobalRuleAbilities(): Abilities<ExternalRuleAction> {
  return useMemo(getExternalGlobalRuleAbilities, []);
}

/** React hook. Returns the `Ability` for a single global external datasource rule action. */
export function useExternalGlobalRuleAbility(action: ExternalRuleAction): Ability {
  return useMemo(() => getExternalGlobalRuleAbility(action), [action]);
}

// ── Explore (no rule context needed) ─────────────────────────────────────────

/**
 * Returns the explore `Ability`. Pure synchronous global RBAC check — no
 * folder-scoped or async dependency.
 */
export function useRuleExploreAbility(): Ability {
  return makeAbility(true, [AccessControlAction.DataSourcesExplore]);
}
