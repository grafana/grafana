export const toUserItem = (user) => ({
    userId: user.user_id,
    roleIds: user.role_ids,
});
export const toMap = (users) => users.reduce((prev, curr) => (Object.assign(Object.assign({}, prev), { [curr.userId]: curr })), {});
//# sourceMappingURL=users.utils.js.map