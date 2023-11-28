export const getUsers = (state) => {
    const regex = new RegExp(state.searchQuery, 'i');
    return state.users.filter((user) => {
        return regex.test(user.login) || regex.test(user.email) || regex.test(user.name);
    });
};
export const getUsersSearchQuery = (state) => state.searchQuery;
//# sourceMappingURL=selectors.js.map