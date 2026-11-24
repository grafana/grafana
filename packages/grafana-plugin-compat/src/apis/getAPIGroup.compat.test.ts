import { type CurrentUserDTO, OrgRole } from '@grafana/data';
import { type BackendSrv, config, setBackendSrv } from '@grafana/runtime';

import { getMockedBackendSrv } from '../utils/mocks';

import { getAPIGroup } from './getAPIGroup';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAPIGroup: undefined,
}));

const mockBackendSrv = getMockedBackendSrv();
const originalUser = config.bootData.user;

const dashboardGroup = {
  name: 'dashboard.grafana.app',
  versions: [
    { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
    { groupVersion: 'dashboard.grafana.app/v0alpha1', version: 'v0alpha1' },
  ],
  preferredVersion: { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
};

function setBootUser(user: Partial<CurrentUserDTO>) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  config.bootData.user = user as CurrentUserDTO;
}

describe('getAPIGroup', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    setBootUser({ isSignedIn: true, orgRole: OrgRole.Viewer });
    mockBackendSrv.get.mockResolvedValue(dashboardGroup);
  });

  afterAll(() => {
    config.bootData.user = originalUser;
  });

  it('should request the group without an error alert when getAPIGroup does not exist', async () => {
    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual({
      group: 'dashboard.grafana.app',
      versions: ['v1beta1', 'v0alpha1'],
      preferredVersion: 'v1beta1',
    });

    expect(mockBackendSrv.get).toHaveBeenCalledTimes(1);
    expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/dashboard.grafana.app/', undefined, undefined, {
      showErrorAlert: false,
    });
  });

  it('should use the first version when the server sends no preferred version', async () => {
    mockBackendSrv.get.mockResolvedValue({ ...dashboardGroup, preferredVersion: undefined });

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toMatchObject({ preferredVersion: 'v1beta1' });
  });

  it('should resolve undefined when the group has no versions', async () => {
    mockBackendSrv.get.mockResolvedValue({ ...dashboardGroup, versions: [], preferredVersion: undefined });

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
  });

  it('should resolve undefined when the response is not an APIGroup', async () => {
    mockBackendSrv.get.mockResolvedValue('<html>Not found</html>');

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
  });

  it.each([404, 401, 403, 500])('should resolve undefined when the request fails with %i', async (status) => {
    mockBackendSrv.get.mockRejectedValue({ status, data: {} });

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
  });

  it('should resolve undefined when getBackendSrv is not set up', async () => {
    setBackendSrv(undefined as unknown as BackendSrv);

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
  });

  it('should resolve undefined without a request when there is no user session', async () => {
    setBootUser({ isSignedIn: false, orgRole: '' });

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
    expect(mockBackendSrv.get).not.toHaveBeenCalled();
  });

  it.each(['', '../api/admin', 'Dashboard.grafana.app', 'dashboard.grafana.app/v1'])(
    'should resolve undefined without a request for the invalid group name %j',
    async (group) => {
      await expect(getAPIGroup(group)).resolves.toBeUndefined();
      expect(mockBackendSrv.get).not.toHaveBeenCalled();
    }
  );

  it('should share one in-flight request per group', async () => {
    const results = await Promise.all([
      getAPIGroup('dashboard.grafana.app'),
      getAPIGroup('dashboard.grafana.app'),
      getAPIGroup('folder.grafana.app'),
    ]);

    expect(results[0]).toBe(results[1]);
    expect(mockBackendSrv.get).toHaveBeenCalledTimes(2);
    expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/dashboard.grafana.app/', undefined, undefined, {
      showErrorAlert: false,
    });
    expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/folder.grafana.app/', undefined, undefined, {
      showErrorAlert: false,
    });
  });

  it('should not cache answers once the request settles', async () => {
    mockBackendSrv.get.mockRejectedValueOnce({ status: 500, data: {} });

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toMatchObject({ group: 'dashboard.grafana.app' });
    await getAPIGroup('dashboard.grafana.app');

    expect(mockBackendSrv.get).toHaveBeenCalledTimes(3);
  });
});
