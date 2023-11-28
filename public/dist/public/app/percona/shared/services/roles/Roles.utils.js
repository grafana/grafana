export const toAccessRole = (response) => (Object.assign(Object.assign({}, response), { roleId: response.role_id }));
export const toUpdateBody = (payload) => ({
    role_id: payload.roleId,
    description: payload.description,
    filter: payload.filter,
    title: payload.title,
});
export const toCreateBody = (payload) => (Object.assign({}, payload));
//# sourceMappingURL=Roles.utils.js.map