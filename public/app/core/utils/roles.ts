import { RoleDto } from 'app/api/clients/legacy';
import { Role } from 'app/types/accessControl';

export const isNotDelegatable = (role: Role) => {
  return role.delegatable !== undefined && !role.delegatable;
};

// addDisplayNameForFixedRole provides a fallback name for fixed roles
// this is "incase" a fixed role is introduced but without a displayname set
// example: currently this would give:
// fixed:datasources:name       -> datasources name
// fixed:datasources:admin      -> datasources admin
// fixed:support.bundles:writer -> support bundles writer
export const addDisplayNameForFixedRole = (role: Role) => {
  const fixedRolePrefix = 'fixed:';
  if (!role.displayName && role.name.startsWith(fixedRolePrefix)) {
    let newRoleName = '';
    let rNameWithoutFixedPrefix = role.name.replace(fixedRolePrefix, '');
    newRoleName = rNameWithoutFixedPrefix.replace(/[:\\.]/g, ' ');
    role.displayName = newRoleName;
  }
  return role;
};

// Adds a display name for use when the list of roles is filtered
// If either group or displayName are undefined, we fall back (see RoleMenuOption.tsx)
export const addFilteredDisplayName = (role: RoleDto): Role => {
  const filteredDisplayName = role.group && role.displayName ? `${role.group}:${role.displayName}` : '';
  return {
    ...role,
    filteredDisplayName,
  };
};

/**
 * Global state store for picker open/closed state that survives component remounts.
 *
 * This store uses the observer pattern to notify React components when state changes.
 * Each picker instance has a unique ID, and the store maintains the open/closed state
 * for all pickers, allowing the state to persist even when components remount due to
 * parent re-renders.
 */
export const pickerStateStore = (() => {
  const states = new Map<string, boolean>();
  const listeners = new Set<() => void>();

  return {
    getState: (key: string) => states.get(key) ?? false,
    setState: (key: string, value: boolean) => {
      states.set(key, value);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();
