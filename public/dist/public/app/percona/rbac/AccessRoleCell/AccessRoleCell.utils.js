export const toOptions = (roles) => roles.map((role) => ({
    label: role.title,
    value: role.roleId,
    ariaLabel: role.title,
}));
export const idsToOptions = (ids, roles) => toOptions(roles.filter((r) => ids.includes(r.roleId)));
//# sourceMappingURL=AccessRoleCell.utils.js.map