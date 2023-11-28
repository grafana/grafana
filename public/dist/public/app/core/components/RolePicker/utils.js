export const isNotDelegatable = (role) => {
    return role.delegatable !== undefined && !role.delegatable;
};
// addDisplayNameForFixedRole provides a fallback name for fixed roles
// this is "incase" a fixed role is introduced but without a displayname set
// example: currently this would give:
// fixed:datasources:name -> datasources name
// fixed:datasources:admin      -> datasources admin
export const addDisplayNameForFixedRole = (role) => {
    const fixedRolePrefix = 'fixed:';
    if (!role.displayName && role.name.startsWith(fixedRolePrefix)) {
        let newRoleName = '';
        let rNameWithoutFixedPrefix = role.name.replace(fixedRolePrefix, '');
        newRoleName = rNameWithoutFixedPrefix.replace(/:/g, ' ');
        role.displayName = newRoleName;
    }
    return role;
};
//# sourceMappingURL=utils.js.map