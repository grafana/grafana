import { getBackendSrv } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { contextSrv } from './context_srv';
import { loadUserPermissions } from './userPermissions';

jest.mock('./userPermissions', () => ({ loadUserPermissions: jest.fn() }));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const mockLoadUserPermissions = jest.mocked(loadUserPermissions);
const mockGet = jest.fn();

describe('fetchUserPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getBackendSrv).mockReturnValue({ get: mockGet } as unknown as ReturnType<typeof getBackendSrv>);
    contextSrv.user.permissions = { 'dashboards:read': true };
  });

  afterEach(() => {
    setTestFlags();
  });

  it('reads from the legacy access-control endpoint by default', async () => {
    mockGet.mockResolvedValue({ 'datasources:read': true });

    await contextSrv.fetchUserPermissions();

    expect(mockGet).toHaveBeenCalledWith('/api/access-control/user/actions', { reloadcache: true });
    expect(mockLoadUserPermissions).not.toHaveBeenCalled();
    expect(contextSrv.user.permissions).toEqual({ 'datasources:read': true });
  });

  it('reads from the IAM app platform API when the flag is on', async () => {
    setTestFlags({ 'grafana.multiTenantUserPermissions': true });
    mockLoadUserPermissions.mockResolvedValue({ 'datasources:read': true });

    await contextSrv.fetchUserPermissions();

    expect(mockGet).not.toHaveBeenCalled();
    expect(contextSrv.user.permissions).toEqual({ 'datasources:read': true });
  });

  // A failed refresh must not downgrade the session to "no permissions" — the
  // user keeps whatever they were granted at boot.
  it('keeps the existing permissions when the IAM request fails', async () => {
    setTestFlags({ 'grafana.multiTenantUserPermissions': true });
    mockLoadUserPermissions.mockResolvedValue(null);

    await contextSrv.fetchUserPermissions();

    expect(contextSrv.user.permissions).toEqual({ 'dashboards:read': true });
  });
});
