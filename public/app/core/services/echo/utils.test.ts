import { CurrentUserDTO, OrgRole } from '@grafana/data';

import { getUserIdentifier } from './utils';

const baseUser: CurrentUserDTO = {
  isSignedIn: true,
  id: 3,
  login: 'myUsername',
  email: 'email@example.com',
  name: 'My Name',
  lightTheme: false,
  orgCount: 1,
  orgId: 1,
  orgName: 'Main Org.',
  orgRole: OrgRole.Admin,
  isGrafanaAdmin: false,
  gravatarUrl: '/avatar/abc-123',
  timezone: 'browser',
  weekStart: 'browser',
  locale: 'en-AU',
  externalUserId: '',
};

const gcomUser: CurrentUserDTO = {
  ...baseUser,
  externalUserId: 'abc-123',
};

describe('echo getUserIdentifier', () => {
  it('should return the external user ID (gcom ID) if available', () => {
    const id = getUserIdentifier(gcomUser);
    expect(id).toBe('abc-123');
  });

  it('should fall back to the email address', () => {
    const id = getUserIdentifier(baseUser);
    expect(id).toBe('email@example.com');
  });
});
