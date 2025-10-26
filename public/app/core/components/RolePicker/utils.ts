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
export const addFilteredDisplayName = (role: Role) => {
  if (role.group && role.displayName) {
    role.filteredDisplayName = role.group + ':' + role.displayName;
  }
  return role;
};
