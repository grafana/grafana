import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getAddToDashboardTitle } from './getAddToDashboardTitle';

jest.mock('app/core/services/context_srv');

const contextSrvMock = jest.mocked(contextSrv);

describe('getAddToDashboardTitle', () => {
  beforeEach(() => contextSrvMock.hasPermission.mockReset());

  it('should return title ending with "dashboard" if user has full access', () => {
    contextSrvMock.hasPermission.mockReturnValue(true);

    expect(getAddToDashboardTitle()).toBe('Add panel to dashboard');
  });

  it('should return title ending with "dashboard" if user has no access', () => {
    contextSrvMock.hasPermission.mockReturnValue(false);

    expect(getAddToDashboardTitle()).toBe('Add panel to dashboard');
  });

  it('should return title ending with "new dashboard" if user only has access to create dashboards', () => {
    contextSrvMock.hasPermission.mockImplementation((action) => {
      return action === AccessControlAction.DashboardsCreate;
    });

    expect(getAddToDashboardTitle()).toBe('Add panel to new dashboard');
  });

  it('should return title ending with "existing dashboard" if user only has access to edit dashboards', () => {
    contextSrvMock.hasPermission.mockImplementation((action) => {
      return action === AccessControlAction.DashboardsWrite;
    });

    expect(getAddToDashboardTitle()).toBe('Add panel to existing dashboard');
  });
});
