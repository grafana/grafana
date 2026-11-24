import { type CurrentUserDTO, OrgRole } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';

import { getMockedBackendSrv } from '../utils/mocks';

import { resolveAPIBaseURL } from './resolveAPIBaseURL';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAPIGroup: undefined,
  resolveAPIVersion: undefined,
  resolveAPIBaseURL: undefined,
}));

const mockBackendSrv = getMockedBackendSrv();
const originalUser = config.bootData.user;
const originalNamespace = config.namespace;

const dashboardGroup = {
  name: 'dashboard.grafana.app',
  versions: [{ groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' }],
  preferredVersion: { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
};

describe('resolveAPIBaseURL', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    config.bootData.user = { isSignedIn: true, orgRole: OrgRole.Viewer } as CurrentUserDTO;
    config.namespace = 'stacks-12345';
    mockBackendSrv.get.mockResolvedValue(dashboardGroup);
  });

  afterAll(() => {
    config.bootData.user = originalUser;
    config.namespace = originalNamespace;
  });

  it('should resolve the namespaced base URL by default', async () => {
    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1'])).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1/namespaces/stacks-12345'
    );
  });

  it('should resolve the cluster-scoped base URL with namespaced: false', async () => {
    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1'], { namespaced: false })).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1'
    );
  });

  it('should resolve undefined when no supported version is served', async () => {
    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v2'])).resolves.toBeUndefined();
  });

  it('should resolve undefined when discovery fails', async () => {
    mockBackendSrv.get.mockRejectedValue({ status: 500, data: {} });

    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1'])).resolves.toBeUndefined();
  });
});
