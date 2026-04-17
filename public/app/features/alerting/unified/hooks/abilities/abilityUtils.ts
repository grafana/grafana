import { contextSrv as ctx } from 'app/core/services/context_srv';
import { type AccessControlAction } from 'app/types/accessControl';

import { type Ability, Granted, InsufficientPermissions, NotSupported } from './types';

/**
 * Builds an `Ability` from a supported flag and an explicit list of `AccessControlActions`.
 * The user is considered allowed if they hold ANY of the listed permissions.
 */
export function makeAbility(supported: boolean, anyOfPermissions: AccessControlAction[]): Ability {
  if (!supported) {
    return NotSupported;
  }
  const hasAny = anyOfPermissions.some((p) => p && ctx.hasPermission(p));
  return hasAny ? Granted : InsufficientPermissions(anyOfPermissions);
}

/**
 * True when the action is granted — both supported in context and permitted by RBAC.
 *
 * @example
 * const exploreAbility = useRuleExploreAbility(rule.rulerRule, groupId);
 * const canExplore = isGranted(exploreAbility);
 */
export function isGranted(ability: Ability): boolean {
  return ability.granted === true;
}

/** True while async checks (folder metadata, plugin settings) are still resolving. */
export function isLoading(ability: Ability): boolean {
  return !ability.granted && ability.cause === 'LOADING';
}

/** True when the action doesn't exist in this context (wrong AM type, disabled feature flag). */
export function isNotSupported(ability: Ability): boolean {
  return !ability.granted && ability.cause === 'NOT_SUPPORTED';
}

/** True when the resource is provisioned and read-only (Terraform, Ansible, provisioning API). */
export function isProvisioned(ability: Ability): boolean {
  return !ability.granted && ability.cause === 'PROVISIONED';
}

/** True when the resource is owned by an installed plugin and cannot be mutated via the UI. */
export function isPluginManaged(ability: Ability): boolean {
  return !ability.granted && ability.cause === 'IS_PLUGIN_MANAGED';
}

/**
 * True when the action is available in this context — it exists and makes sense here —
 * regardless of whether the current user can perform it.
 *
 * Use this for the **show-but-disable** pattern: render a button (possibly disabled) only
 * when `isAvailable`, and hide it entirely when `isNotSupported` or `isLoading`.
 *
 * Implemented as the inverse of the "hide entirely" causes (`LOADING`, `NOT_SUPPORTED`),
 * so any future cause is automatically included (shown disabled) unless explicitly added
 * to the exclusion list here.
 *
 * @example
 * {isAvailable(exportAbility) && (
 *   <Button disabled={!isGranted(exportAbility)} onClick={handleExport}>Export</Button>
 * )}
 */
export function isAvailable(ability: Ability): boolean {
  if (ability.granted) {
    return true;
  }
  // Hide entirely for structural exclusions — all other causes remain visible (disabled)
  return ability.cause !== 'LOADING' && ability.cause !== 'NOT_SUPPORTED';
}
