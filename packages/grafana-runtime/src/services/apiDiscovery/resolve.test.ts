import { config } from '../../config';

import { invalidateAPIDiscovery, setAPIDiscoveryForTesting } from './discovery';
import { resolveAPIBaseURL, resolveAPIVersion } from './resolve';

const originalNamespace = config.namespace;

const dashboardGroup = {
  group: 'dashboard.grafana.app',
  versions: ['v1beta1', 'v0alpha1'],
  preferredVersion: 'v1beta1',
};

const folderGroup = {
  group: 'folder.grafana.app',
  versions: ['v1'],
  preferredVersion: 'v1',
};

beforeEach(() => {
  setAPIDiscoveryForTesting([dashboardGroup, folderGroup]);
  config.namespace = 'stacks-12345';
});

afterAll(() => {
  invalidateAPIDiscovery();
  config.namespace = originalNamespace;
});

describe('resolveAPIVersion', () => {
  it('resolves the version for the requested group', async () => {
    await expect(resolveAPIVersion('dashboard.grafana.app', ['v0alpha1', 'v1beta1'])).resolves.toBe('v1beta1');
    await expect(resolveAPIVersion('folder.grafana.app', ['v1', 'v1beta1'])).resolves.toBe('v1');
  });

  it('returns undefined when the group is not served', async () => {
    await expect(resolveAPIVersion('annotation.grafana.app', ['v1beta1'])).resolves.toBeUndefined();
  });

  it('returns undefined when no supported version is served', async () => {
    await expect(resolveAPIVersion('dashboard.grafana.app', ['v2'])).resolves.toBeUndefined();
  });
});

describe('resolveAPIBaseURL', () => {
  it('returns the namespaced base URL by default', async () => {
    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1'])).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1/namespaces/stacks-12345'
    );
  });

  it('returns the cluster-scoped base URL with namespaced: false', async () => {
    await expect(resolveAPIBaseURL('dashboard.grafana.app', ['v1beta1'], { namespaced: false })).resolves.toBe(
      '/apis/dashboard.grafana.app/v1beta1'
    );
  });

  it('returns undefined when no version resolves', async () => {
    await expect(resolveAPIBaseURL('annotation.grafana.app', ['v1beta1'])).resolves.toBeUndefined();
  });
});
