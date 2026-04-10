import { type AbilityState } from './types';

/**
 * True when the action is granted — both supported in context and permitted by RBAC.
 *
 * @example
 * const exploreAbility = useRuleExploreAbility(rule.rulerRule, groupId);
 * const canExplore = isGranted(exploreAbility);
 */
export function isGranted(ability: AbilityState): boolean {
  return ability.granted === true;
}

/** True while async checks (folder metadata, plugin settings) are still resolving. */
export function isLoading(ability: AbilityState): boolean {
  return !ability.granted && ability.cause === 'LOADING';
}

/** True when the action doesn't exist in this context (wrong AM type, disabled feature flag). */
export function isNotSupported(ability: AbilityState): boolean {
  return !ability.granted && ability.cause === 'NOT_SUPPORTED';
}

/** True when the resource is provisioned and read-only (Terraform, Ansible, provisioning API). */
export function isProvisioned(ability: AbilityState): boolean {
  return !ability.granted && ability.cause === 'PROVISIONED';
}

/** True when the resource is owned by an installed plugin and cannot be mutated via the UI. */
export function isPluginManaged(ability: AbilityState): boolean {
  return !ability.granted && ability.cause === 'IS_PLUGIN_MANAGED';
}

/**
 * True when the action is available in this context — it exists and makes sense here —
 * regardless of whether the current user can perform it.
 *
 * Use this for the **show-but-disable** pattern: render a button (possibly disabled) only
 * when `isAvailable`, and hide it entirely when `isNotSupported` or `isLoading`.
 *
 * @example
 * {isAvailable(exportAbility) && (
 *   <Button disabled={!isGranted(exportAbility)} onClick={handleExport}>Export</Button>
 * )}
 */
export function isAvailable(ability: AbilityState): boolean {
  return (
    ability.granted ||
    ability.cause === 'PROVISIONED' ||
    ability.cause === 'IS_PLUGIN_MANAGED' ||
    ability.cause === 'INSUFFICIENT_PERMISSIONS'
  );
}
