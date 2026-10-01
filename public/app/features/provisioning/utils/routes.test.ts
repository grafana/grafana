import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { CONNECTIONS_URL } from '../constants';

import { getProvisioningRoutes } from './routes';

jest.mock('../GettingStarted/features', () => ({
  checkRequiredFeatures: () => true,
}));

describe('getProvisioningRoutes', () => {
  const originalProvisioningEnabled = config.provisioningEnabled;
  let evaluatePermissionSpy: jest.SpyInstance;

  beforeEach(() => {
    config.provisioningEnabled = true;
    evaluatePermissionSpy = jest.spyOn(contextSrv, 'evaluatePermission').mockReturnValue([]);
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioningEnabled;
    evaluatePermissionSpy.mockRestore();
  });

  // Guards must mirror the verb each page performs against the connections API.
  it.each([
    [`${CONNECTIONS_URL}/oauth-callback`, [AccessControlAction.ProvisioningConnectionsWrite]],
    [`${CONNECTIONS_URL}/:name/edit`, [AccessControlAction.ProvisioningConnectionsWrite]],
    [`${CONNECTIONS_URL}/new`, [AccessControlAction.ProvisioningConnectionsCreate]],
  ])('guards %s with the permission for the verb the page performs', (path, expectedActions) => {
    const route = getProvisioningRoutes().find((r) => r.path === path);

    expect(route?.roles).toBeDefined();
    route?.roles?.();
    expect(evaluatePermissionSpy).toHaveBeenCalledWith(expectedActions);
  });
});
