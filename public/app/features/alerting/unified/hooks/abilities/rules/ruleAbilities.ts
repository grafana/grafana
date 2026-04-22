/**
 * ruleAbilities.ts — unscoped (global / list-level) rule RBAC ability hooks
 *
 * These hooks check whether the current user can perform rule actions in general,
 * without requiring a specific rule instance. They are synchronous (no async folder
 * or plugin checks) and suitable for gating list-level UI (create buttons, nav tabs).
 *
 * For per-rule (entity-scoped) ability checks, see scopedRuleAbilities.ts.
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

export function useGlobalRuleAbilities(): Abilities<RuleAction> {
  const canCreate = ctx.hasPermission(AccessControlAction.AlertingRuleCreate);
  const canRead = ctx.hasPermission(AccessControlAction.AlertingRuleRead);
  const canUpdate = ctx.hasPermission(AccessControlAction.AlertingRuleUpdate);
  const canDelete = ctx.hasPermission(AccessControlAction.AlertingRuleDelete);
  // Import requires BOTH create and provisioning-set-status (AND logic).
  // anyOfPermissions lists both so the tooltip shows everything that's needed.
  const canProvisioningSetStatus = ctx.hasPermission(AccessControlAction.AlertingProvisioningSetStatus);

  return useMemo<Abilities<RuleAction>>(
    () => ({
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
    }),
    [canCreate, canRead, canUpdate, canDelete, canProvisioningSetStatus]
  );
}

export function useGlobalRuleAbility(action: RuleAction): Ability {
  const all = useGlobalRuleAbilities();
  return useMemo(() => all[action], [all, action]);
}

// ── External datasource rule abilities (global / list level) ──────────────────

export function useExternalGlobalRuleAbilities(): Abilities<ExternalRuleAction> {
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

export function useExternalGlobalRuleAbility(action: ExternalRuleAction): Ability {
  const all = useExternalGlobalRuleAbilities();
  return useMemo(() => all[action], [all, action]);
}

// ── Explore (no rule context needed) ─────────────────────────────────────────

/**
 * Returns the explore `Ability`.
 * This is a pure synchronous global RBAC check — `DataSourcesExplore` has no
 * folder-scoped or async dependency, so no rule or group identifier is needed.
 */
export function useRuleExploreAbility(): Ability {
  return makeAbility(true, [AccessControlAction.DataSourcesExplore]);
}
