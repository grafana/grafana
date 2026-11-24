import { config } from '../../config';

import { getApiGroup } from './discovery';
import { resolveApiBaseURL, resolveApiVersion } from './resolve';

jest.mock('./discovery', () => ({
  getApiGroup: jest.fn(),
}));

const getApiGroupMock = jest.mocked(getApiGroup);
const originalNamespace = config.namespace;

const dashboardGroup = {
  group: 'dashboard.grafana.app',
  versions: ['v1beta1', 'v0alpha1'],
  preferredVersion: 'v1beta1',
};

beforeEach(() => {
  jest.resetAllMocks();
  config.namespace = 'stacks-12345';
});

afterAll(() => {
  config.namespace = originalNamespace;
});

describe('resolveApiVersion', () => {
  it('resolves the version for the requested group', async () => {
    getApiGroupMock.mockResolvedValue(dashboardGroup);

    await expect(resolveApiVersion('dashboard.grafana.app', ['v0alpha1', 'v1beta1'])).resolves.toBe('v1beta1');
    expect(getApiGroupMock).toHaveBeenCalledWith('dashboard.grafana.app');
  });

  it('returns undefined when the group is not served or unknown', async () => {
    getApiGroupMock.mockResolvedValue(undefined);

    await expect(resolveApiVersion('dashboard.grafana.app', ['v1beta1'])).resolves.toBeUndefined();
  });

  it('returns undefined when no supported version is served', async () => {
    getApiGroupMock.mockResolvedValue(dashboardGroup);

    await expect(resolveApiVersion('dashboard.grafana.app', ['v2'])).resolves.toBeUndefined();
  });
});

describe('resolveApiBaseURL', () => {
  it('returns the namespaced base URL by default', async () => {
    getApiGroupMock.mockResolvedValue(dashboardGroup);

    await expect(resolveApiBaseURL('dashboard.grafana.app', ['v1beta1'])).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1/namespaces/stacks-12345'
    );
  });

  it('returns the cluster-scoped base URL with namespaced: false', async () => {
    getApiGroupMock.mockResolvedValue(dashboardGroup);

    await expect(resolveApiBaseURL('dashboard.grafana.app', ['v1beta1'], { namespaced: false })).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1'
    );
  });

  it('returns undefined when no version resolves', async () => {
    getApiGroupMock.mockResolvedValue(undefined);

    await expect(resolveApiBaseURL('dashboard.grafana.app', ['v1beta1'])).resolves.toBeUndefined();
  });
});
