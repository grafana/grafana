import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { hasSavedQueryReadPermissions } from './identity';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
    isSignedIn: false,
  },
}));

const mockContextSrv = jest.mocked(contextSrv);

describe('hasSavedQueryReadPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextSrv.isSignedIn = false;
  });

  it('returns true when the user has the queries:read permission', () => {
    mockContextSrv.hasPermission.mockReturnValue(true);

    expect(hasSavedQueryReadPermissions()).toBe(true);
    expect(mockContextSrv.hasPermission).toHaveBeenCalledWith(AccessControlAction.QueriesRead);
  });

  it('returns false when the user lacks the queries:read permission, even if signed in', () => {
    mockContextSrv.hasPermission.mockReturnValue(false);
    mockContextSrv.isSignedIn = true;

    expect(hasSavedQueryReadPermissions()).toBe(false);
  });
});
