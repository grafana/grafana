export const toAccessRoleRow = (role, roleId) => (Object.assign(Object.assign({}, role), { isDefault: role.roleId === roleId }));
export const orderRole = (a, b) => {
    if (a.isDefault) {
        return -1;
    }
    if (b.isDefault) {
        return 1;
    }
    return a.title.localeCompare(b.title);
};
//# sourceMappingURL=AccessRole.utils.js.map