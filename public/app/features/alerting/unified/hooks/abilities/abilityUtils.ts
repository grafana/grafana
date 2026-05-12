import { contextSrv as ctx } from 'app/core/services/context_srv';
import { type AccessControlAction } from 'app/types/accessControl';

import { type EntityToCheck, isK8sEntityProvisioned } from '../../utils/k8s/utils';

import { type Ability, type AsyncAbility, Granted, InsufficientPermissions, NotSupported, Provisioned } from './types';

/**
 * Returns `true` when the current user holds **any** of the listed RBAC permissions.
 * Use this as a plain boolean predicate where you do not need a full {@link Ability} value.
 */
export function hasAnyPermission(anyOfPermissions: AccessControlAction[]): boolean {
  return anyOfPermissions.some((p) => p && ctx.hasPermission(p));
}

/**
 * Builds a synchronous {@link Ability} from a supported flag and an explicit list of
 * `AccessControlActions`. The user is considered allowed if they hold ANY of the listed
 * permissions. Never returns `LOADING`.
 */
export function makeAbility(supported: boolean, anyOfPermissions: AccessControlAction[]): Ability {
  if (!supported) {
    return NotSupported;
  }
  return hasAnyPermission(anyOfPermissions) ? Granted : InsufficientPermissions(anyOfPermissions);
}

/**
 * Builds a synchronous {@link Ability} for a k8s-backed entity.
 *
 * Guards (in order):
 * 1. `supported === false`   → NotSupported
 * 2. entity is provisioned   → Provisioned
 * 3. `canAccess` provided:
 *    - false                 → InsufficientPermissions
 *    - true                  → Granted  (trusts the server-set access annotation rather
 *                               than re-checking global RBAC, which may not hold for
 *                               folder-scoped users)
 *    `canAccess` absent      → delegates to {@link makeAbility} (global RBAC check)
 */
export function makeScopedAbility(
  supported: boolean,
  anyOfPermissions: AccessControlAction[],
  entity: EntityToCheck,
  canAccess?: (entity: EntityToCheck) => boolean
): Ability {
  if (!supported) {
    return NotSupported;
  }
  if (isK8sEntityProvisioned(entity)) {
    return Provisioned;
  }
  if (canAccess !== undefined) {
    return canAccess(entity) ? Granted : InsufficientPermissions(anyOfPermissions);
  }
  return makeAbility(true, anyOfPermissions);
}

/**
 * True when the action is granted — both supported in context and permitted by RBAC.
 * Accepts both {@link Ability} and {@link AsyncAbility}.
 *
 * @example
 * const exploreAbility = useRuleExploreAbility();
 * const canExplore = isGranted(exploreAbility);
 */
export function isGranted(ability: AsyncAbility): boolean {
  return ability.granted === true;
}

/**
 * True while async checks (folder metadata, plugin settings) are still resolving.
 * Only meaningful on {@link AsyncAbility} — sync {@link Ability} hooks never enter this state.
 */
export function isLoading(ability: AsyncAbility): boolean {
  return !ability.granted && ability.cause === 'LOADING';
}

/** True when the action doesn't exist in this context (wrong AM type, disabled feature flag). */
export function isNotSupported(ability: AsyncAbility): boolean {
  return !ability.granted && ability.cause === 'NOT_SUPPORTED';
}

/** True when the resource is provisioned and read-only (Terraform, Ansible, provisioning API). */
export function isProvisioned(ability: AsyncAbility): boolean {
  return !ability.granted && ability.cause === 'PROVISIONED';
}

/** True when the resource is owned by an installed plugin and cannot be mutated via the UI. */
export function isPluginManaged(ability: AsyncAbility): boolean {
  return !ability.granted && ability.cause === 'IS_PLUGIN_MANAGED';
}

/**
 * True when the action is available in this context — it exists and makes sense here —
 * regardless of whether the current user can perform it.
 *
 * Use this for the **show-but-disable** pattern: render a button (possibly disabled) only
 * when `isSupported`, and hide it entirely when `isNotSupported` or `isLoading`.
 *
 * Accepts both {@link Ability} and {@link AsyncAbility}. The `LOADING` check is only
 * meaningful for async abilities; for sync abilities it is always false and optimised away
 * by TypeScript's control-flow analysis.
 *
 * @example
 * {isSupported(exportAbility) && (
 *   <Button disabled={!isGranted(exportAbility)} onClick={handleExport}>Export</Button>
 * )}
 */
export function isSupported(ability: AsyncAbility): boolean {
  if (ability.granted) {
    return true;
  }
  // Hide entirely for structural exclusions — all other causes remain visible (disabled)
  return ability.cause !== 'LOADING' && ability.cause !== 'NOT_SUPPORTED';
}
