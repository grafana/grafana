export var getMockUsers = function (amount) {
    var users = [];
    for (var i = 0; i <= amount; i++) {
        users.push({
            avatarUrl: 'url/to/avatar',
            email: "user-" + i + "@test.com",
            lastSeenAt: '2018-10-01',
            lastSeenAtAge: '',
            login: "user-" + i,
            orgId: 1,
            role: 'Admin',
            userId: i,
        });
    }
    return users;
};
export var getMockUser = function () {
    return {
        avatarUrl: 'url/to/avatar',
        email: "user@test.com",
        lastSeenAt: '2018-10-01',
        lastSeenAtAge: '',
        login: "user",
        orgId: 1,
        role: 'Admin',
        userId: 2,
    };
};
export var getMockInvitees = function (amount) {
    var invitees = [];
    for (var i = 0; i <= amount; i++) {
        invitees.push({
            code: "asdfasdfsadf-" + i,
            createdOn: '2018-10-02',
            email: "invitee-" + i + "@test.com",
            emailSent: true,
            emailSentOn: '2018-10-02',
            id: i,
            invitedByEmail: 'admin@grafana.com',
            invitedByLogin: 'admin',
            invitedByName: 'admin',
            name: "invitee-" + i,
            orgId: 1,
            role: 'viewer',
            status: 'not accepted',
            url: "localhost/invite/" + i,
        });
    }
    return invitees;
};
//# sourceMappingURL=userMocks.js.map