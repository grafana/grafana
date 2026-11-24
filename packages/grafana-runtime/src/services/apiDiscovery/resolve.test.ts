import { config } from '../../config';

import { getAPIGroup, getAPIGroupOutcome } from './discovery';
import { resolveAPIBaseURL, resolveAPIBaseURLOutcome, resolveAPIVersion } from './resolve';

jest.mock('./discovery', () => ({
  getAPIGroup: jest.fn(),
  getAPIGroupOutcome: jest.fn(),
}));

const getAPIGroupMock = jest.mocked(getAPIGroup);
const getAPIGroupOutcomeMock = jest.mocked(getAPIGroupOutcome);
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

describe('resolveAPIVersion', () => {
  it('resolves the version for the requested group', async () => {
    getAPIGroupMock.mockResolvedValue(dashboardGroup);

    await expect(resolveAPIVersion('dashboard.grafana.app', ['v0alpha1', 'v1beta1'])).resolves.toBe('v1beta1');
    expect(getAPIGroupMock).toHaveBeenCalledWith('dashboard.grafana.app');
  });

  it('returns undefined when the group is not served or unknown', async () => {
    getAPIGroupMock.mockResolvedValue(undefined);

    await expect(resolveAPIVersion('dashboard.grafana.app', ['v1beta1'])).resolves.toBeUndefined();
  });

  it('returns undefined when no supported version is served', async () => {
    getAPIGroupMock.mockResolvedValue(dashboardGroup);

    await expect(resolveAPIVersion('dashboard.grafana.app', ['v2'])).resolves.toBeUndefined();
  });
});

describe('resolveAPIBaseURL', () => {
  it('returns the namespaced base URL by default', async () => {
    getAPIGroupMock.mockResolvedValue(dashboardGroup);

    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1'])).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1/namespaces/stacks-12345'
    );
  });

  it('returns the cluster-scoped base URL with namespaced: false', async () => {
    getAPIGroupMock.mockResolvedValue(dashboardGroup);

    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1'], { namespaced: false })).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1'
    );
  });

  it('returns undefined when no version resolves', async () => {
    getAPIGroupMock.mockResolvedValue(undefined);

    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1'])).resolves.toBeUndefined();
  });
});

describe('resolveAPIBaseURLOutcome', () => {
  it('returns the base URL of a served group', async () => {
    getAPIGroupOutcomeMock.mockResolvedValue({ kind: 'known', value: dashboardGroup });

    await expect(resolveAPIBaseURLOutcome('dashboard.grafana.app', ['v0alpha1', 'v1beta1'])).resolves.toEqual({
      kind: 'known',
      value: '/apis/dashboard.grafana.app/v1beta1/namespaces/stacks-12345',
    });
  });

  it.each([
    ['is not served', { kind: 'known' as const, value: undefined }],
    ['is served in no supported version', { kind: 'known' as const, value: dashboardGroup }],
  ])('is known with no URL when the group %s', async (_, outcome) => {
    getAPIGroupOutcomeMock.mockResolvedValue(outcome);

    await expect(resolveAPIBaseURLOutcome('dashboard.grafana.app', ['v2'])).resolves.toEqual({
      kind: 'known',
      value: undefined,
    });
  });

  it('is unknown when discovery cannot answer', async () => {
    getAPIGroupOutcomeMock.mockResolvedValue({ kind: 'unknown' });

    await expect(resolveAPIBaseURLOutcome('dashboard.grafana.app', ['v1beta1'])).resolves.toEqual({ kind: 'unknown' });
  });

  it('returns the cluster-scoped base URL with namespaced: false', async () => {
    getAPIGroupOutcomeMock.mockResolvedValue({ kind: 'known', value: dashboardGroup });

    await expect(
      resolveAPIBaseURLOutcome('dashboard.grafana.app', ['v1beta1'], { namespaced: false })
    ).resolves.toEqual({ kind: 'known', value: '/apis/dashboard.grafana.app/v1beta1' });
  });
});
