import { contextSrv } from '../services/context_srv';

import { appendOrgId } from './navigationUrl';

jest.mock('../services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 0 },
  },
}));

describe('appendOrgId', () => {
  beforeEach(() => {
    contextSrv.user.orgId = 7;
  });

  it('returns path unchanged when no orgId is set', () => {
    contextSrv.user.orgId = 0;
    expect(appendOrgId('/admin/users')).toBe('/admin/users');
  });

  it('appends orgId to a path without query or fragment', () => {
    expect(appendOrgId('/admin/users')).toBe('/admin/users?orgId=7');
  });

  it('appends orgId with & when path already has a query', () => {
    expect(appendOrgId('/admin/users?filter=active')).toBe('/admin/users?filter=active&orgId=7');
  });

  it('places orgId before the fragment on a path with no query', () => {
    expect(appendOrgId('/admin/users#section')).toBe('/admin/users?orgId=7#section');
  });

  it('places orgId before the fragment on a path with a query', () => {
    expect(appendOrgId('/admin/users?filter=active#section')).toBe('/admin/users?filter=active&orgId=7#section');
  });

  it('returns path unchanged when orgId is already in the query', () => {
    expect(appendOrgId('/admin/users?orgId=5')).toBe('/admin/users?orgId=5');
  });

  it('returns path unchanged when orgId is already in the query with a fragment', () => {
    expect(appendOrgId('/admin/users?orgId=5#section')).toBe('/admin/users?orgId=5#section');
  });
});
