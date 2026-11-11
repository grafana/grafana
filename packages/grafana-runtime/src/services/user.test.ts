import { type CurrentUserDTO, OrgRole } from '@grafana/data';

import { config } from '../config';

import { isSignedInAnonymousOrPublicAccess, isSignedInOrAnonymous } from './user';

const originalUser = config.bootData.user;

function setBootUser(user: Partial<CurrentUserDTO>) {
  config.bootData.user = user as CurrentUserDTO;
}

afterEach(() => {
  config.bootData.user = originalUser;
  config.publicDashboardAccessToken = undefined;
});

describe('isSignedInOrAnonymous', () => {
  it('is true for a signed-in user', () => {
    setBootUser({ isSignedIn: true, orgRole: OrgRole.Admin });

    expect(isSignedInOrAnonymous()).toBe(true);
  });

  it('is true for an anonymous user, who has an org role but is not signed in', () => {
    setBootUser({ isSignedIn: false, orgRole: OrgRole.Viewer });

    expect(isSignedInOrAnonymous()).toBe(true);
  });

  it('is false without a session', () => {
    setBootUser({ isSignedIn: false, orgRole: '' });

    expect(isSignedInOrAnonymous()).toBe(false);
  });

  it('is false when boot data has no user fields', () => {
    setBootUser({});

    expect(isSignedInOrAnonymous()).toBe(false);
  });

  it('is false for a public dashboard viewer', () => {
    setBootUser({ isSignedIn: false, orgRole: '' });
    config.publicDashboardAccessToken = 'token';

    expect(isSignedInOrAnonymous()).toBe(false);
  });
});

describe('isSignedInAnonymousOrPublicAccess', () => {
  it('is true for a signed-in user', () => {
    setBootUser({ isSignedIn: true, orgRole: OrgRole.Admin });

    expect(isSignedInAnonymousOrPublicAccess()).toBe(true);
  });

  it('is true for an anonymous user', () => {
    setBootUser({ isSignedIn: false, orgRole: OrgRole.Viewer });

    expect(isSignedInAnonymousOrPublicAccess()).toBe(true);
  });

  it('is true for a public dashboard viewer without a session', () => {
    setBootUser({ isSignedIn: false, orgRole: '' });
    config.publicDashboardAccessToken = 'token';

    expect(isSignedInAnonymousOrPublicAccess()).toBe(true);
  });

  it('is false without a session or a public dashboard', () => {
    setBootUser({ isSignedIn: false, orgRole: '' });

    expect(isSignedInAnonymousOrPublicAccess()).toBe(false);
  });
});
