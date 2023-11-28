export const getOptions = (roles, roleToDelete) => roles.filter((role) => role.roleId !== roleToDelete.roleId).map(roleToOption);
export const roleToOption = (role) => ({
    label: role.title,
    value: role.roleId,
});
export const getDefaultFormValues = (defaultRole) => defaultRole
    ? {
        replacementRoleId: roleToOption(defaultRole),
    }
    : undefined;
export const isRoleAssigned = (role, usersInfo, users) => usersInfo.some((u) => u.roleIds.includes(role.roleId) && users.some((orgUser) => orgUser.userId === u.userId));
//# sourceMappingURL=DeleteRoleModal.utils.js.map