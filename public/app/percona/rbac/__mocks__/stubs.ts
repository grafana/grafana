import { PrometheusDatasource } from '@grafana/prometheus';
import { UserItem } from 'app/percona/shared/core/reducers/users/users.types';
import { AccessRole } from 'app/percona/shared/services/roles/Roles.types';
import { OrgRole, OrgUser } from 'app/types';

export const stubUserSingleRole: OrgUser = {
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

export const subUserMultipleRoles: OrgUser = {
  ...stubUserSingleRole,
  userId: 3,
};

export const stubRoles: AccessRole[] = [
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

export const stubUsers: UserItem[] = [
  { userId: 2, roleIds: [1] },
  { userId: 3, roleIds: [1, 2] },
];

export const stubUsersMap: Record<number, UserItem> = {
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
    syntax: () => {},
    getLabelKeys: () => [],
    metrics: [],
  },
} as unknown as PrometheusDatasource;
