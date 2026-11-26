import { type CurrentUserDTO, OrgRole } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';

import { getMockedBackendSrv } from '../utils/mocks';

import { resolveAPIVersion } from './resolveAPIVersion';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAPIGroup: undefined,
  resolveAPIVersion: undefined,
}));

const mockBackendSrv = getMockedBackendSrv();
const originalUser = config.bootData.user;

const dashboardGroup = {
  name: 'dashboard.grafana.app',
  versions: [
    { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
    { groupVersion: 'dashboard.grafana.app/v0alpha1', version: 'v0alpha1' },
    { groupVersion: 'dashboard.grafana.app/v2beta1', version: 'v2beta1' },
  ],
  preferredVersion: { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
};

describe('resolveAPIVersion', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    config.bootData.user = { isSignedIn: true, orgRole: OrgRole.Viewer } as CurrentUserDTO;
    mockBackendSrv.get.mockResolvedValue(dashboardGroup);
  });

  afterAll(() => {
    config.bootData.user = originalUser;
  });

  it("should resolve the server's preferred version when it is supported", async () => {
    await expect(resolveAPIVersion('dashboard.grafana.app', ['v0alpha1', 'v1beta1'])).resolves.toBe('v1beta1');
    expect(mockBackendSrv.get).toHaveBeenCalledWith('/apis/dashboard.grafana.app/', undefined, undefined, {
      showErrorAlert: false,
    });
  });

  it('should resolve the most stable shared version when the preferred one is not supported', async () => {
    await expect(resolveAPIVersion('dashboard.grafana.app', ['v0alpha1', 'v2beta1'])).resolves.toBe('v2beta1');
  });

  it('should resolve undefined when no supported version is served', async () => {
    await expect(resolveAPIVersion('dashboard.grafana.app', ['v2'])).resolves.toBeUndefined();
  });

  it('should resolve undefined when the group is not served', async () => {
    mockBackendSrv.get.mockRejectedValue({ status: 404, data: {} });

    await expect(resolveAPIVersion('dashboard.grafana.app', ['v1beta1'])).resolves.toBeUndefined();
  });
});
