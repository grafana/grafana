import { OrgRole } from 'app/types';
export const stubUserSingleRole = {
    avatarUrl: 'url/to/avatar',
    email: `user@test.com`,
    name: 'user test',
    lastSeenAt: '2018-10-01',
    lastSeenAtAge: '',
    login: `user`,
    orgId: 1,
    role: OrgRole.Admin,
    userId: 2,
    isDisabled: false,
};
export const subUserMultipleRoles = Object.assign(Object.assign({}, stubUserSingleRole), { userId: 3 });
export const stubRoles = [
    {
        roleId: 1,
        title: 'Role #1',
        filter: '',
    },
    {
        roleId: 2,
        title: 'Role #2',
        filter: '',
    },
];
export const stubUsers = [
    { userId: 2, roleIds: [1] },
    { userId: 3, roleIds: [1, 2] },
];
export const stubUsersMap = {
    2: stubUsers[0],
    3: stubUsers[1],
};
export const dataSourceMock = {
    createQuery: jest.fn((q) => q),
    getInitHints: () => [],
    getPrometheusTime: jest.fn((date, roundup) => 123),
    getQueryHints: jest.fn(() => []),
    languageProvider: {
        start: () => Promise.resolve([]),
        syntax: () => { },
        getLabelKeys: () => [],
        metrics: [],
    },
};
//# sourceMappingURL=stubs.js.map