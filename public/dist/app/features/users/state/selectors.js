export var getUsers = function (state) {
    var regex = new RegExp(state.searchQuery, 'i');
    return state.users.filter(function (user) {
        return regex.test(user.login) || regex.test(user.email);
    });
};
export var getInvitees = function (state) {
    var regex = new RegExp(state.searchQuery, 'i');
    return state.invitees.filter(function (invitee) {
        return regex.test(invitee.name) || regex.test(invitee.email);
    });
};
export var getInviteesCount = function (state) { return state.invitees.length; };
export var getUsersSearchQuery = function (state) { return state.searchQuery; };
//# sourceMappingURL=selectors.js.map