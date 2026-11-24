import { type CurrentUserDTO, OrgRole } from '@grafana/data';

import { config } from '../../config';
import { type BackendSrv, type FetchError, setBackendSrv } from '../backendSrv';
import { setLogger } from '../logging/registry';

import {
  API_DISCOVERY_TIMEOUT_MS,
  getAllAPIResources,
  getAPIGroup,
  getAPIResources,
  invalidateAPIDiscovery,
  isAPIResourceAvailable,
  setAPIDiscoveryForTesting,
} from './discovery';
import {
  type K8sAPIGroup,
  type K8sAPIGroupDiscoveryList,
  type K8sAPIGroupList,
  type K8sAPIResourceList,
} from './types';

const backendGet = jest.fn();
const logError = jest.fn();
const logWarning = jest.fn();
const originalUser = config.bootData.user;
const originalPublicDashboardAccessToken = config.publicDashboardAccessToken;

const dashboardGroup: K8sAPIGroup = {
  name: 'dashboard.grafana.app',
  versions: [
    { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
    { groupVersion: 'dashboard.grafana.app/v0alpha1', version: 'v0alpha1' },
  ],
  preferredVersion: { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
};

const groupList: K8sAPIGroupList = { groups: [dashboardGroup] };

const dashboardInfo = {
  group: 'dashboard.grafana.app',
  versions: ['v1beta1', 'v0alpha1'],
  preferredVersion: 'v1beta1',
};

function fetchError(status: number): FetchError {
  return { status, statusText: `status ${status}`, data: {}, config: { url: '/apis' } };
}

function setBootUser(user: Partial<CurrentUserDTO> | undefined) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  config.bootData.user = user as CurrentUserDTO;
}

const AGGREGATED_ROUTE = 'aggregated /apis';

// The aggregated list shares its URL with the plain group list, so it gets its own route name.
function routeOf(url: string, options?: { headers?: Record<string, string> }): string {
  return options?.headers?.Accept?.includes('as=APIGroupDiscoveryList') ? AGGREGATED_ROUTE : url;
}

function respondTo(routes: Record<string, () => Promise<unknown>>) {
  backendGet.mockImplementation((url: string, _params, _requestId, options) => {
    const route = routes[routeOf(url, options)];
    return route ? route() : Promise.reject(fetchError(404));
  });
}

function requestedUrls(): string[] {
  return backendGet.mock.calls.map(([url, , , options]) => routeOf(url, options));
}

beforeEach(() => {
  jest.clearAllMocks();
  invalidateAPIDiscovery();
  setBackendSrv({ get: backendGet } as unknown as BackendSrv);
  setLogger('grafana/runtime.apis.discovery', {
    logDebug: jest.fn(),
    logError,
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning,
  });
  setBootUser({ isSignedIn: true, orgRole: OrgRole.Viewer });
  config.publicDashboardAccessToken = undefined;
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  config.bootData.user = originalUser;
  config.publicDashboardAccessToken = originalPublicDashboardAccessToken;
});

describe('getAPIGroup', () => {
  describe('when the root request succeeds', () => {
    beforeEach(() => {
      respondTo({ '/apis': () => Promise.resolve(groupList) });
    });

    it('returns the group in server order with its preferred version', async () => {
      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
    });

    it('requests the plain group list without an error toast', async () => {
      await getAPIGroup('dashboard.grafana.app');

      expect(backendGet).toHaveBeenCalledWith(
        '/apis',
        undefined,
        undefined,
        expect.objectContaining({ showErrorAlert: false })
      );
    });

    it('returns undefined for a group the server does not list, without logging', async () => {
      await expect(getAPIGroup('annotation.grafana.app')).resolves.toBeUndefined();
      expect(logError).not.toHaveBeenCalled();
    });

    it('caches the list for served and unlisted groups', async () => {
      await getAPIGroup('dashboard.grafana.app');
      await getAPIGroup('annotation.grafana.app');
      await getAPIGroup('dashboard.grafana.app');

      expect(requestedUrls()).toEqual(['/apis']);
    });

    it('shares one in-flight request between concurrent callers', async () => {
      const results = await Promise.all([
        getAPIGroup('dashboard.grafana.app'),
        getAPIGroup('dashboard.grafana.app'),
        getAPIGroup('annotation.grafana.app'),
      ]);

      expect(results).toEqual([dashboardInfo, dashboardInfo, undefined]);
      expect(requestedUrls()).toEqual(['/apis']);
    });

    it('requests the list again after invalidateAPIDiscovery()', async () => {
      await getAPIGroup('dashboard.grafana.app');
      invalidateAPIDiscovery();
      await getAPIGroup('dashboard.grafana.app');

      expect(requestedUrls()).toEqual(['/apis', '/apis']);
    });

    it('uses the first listed version when the server names no preferred version', async () => {
      const { preferredVersion, ...withoutPreferred } = dashboardGroup;
      respondTo({ '/apis': () => Promise.resolve({ groups: [withoutPreferred] }) });

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toMatchObject({ preferredVersion: 'v1beta1' });
    });

    it('treats a listed group without versions as not served', async () => {
      respondTo({ '/apis': () => Promise.resolve({ groups: [{ ...dashboardGroup, versions: [] }] }) });

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
    });
  });

  describe('when the root request fails', () => {
    it.each([
      ['a server error', () => Promise.reject(fetchError(500))],
      ['a 401', () => Promise.reject(fetchError(401))],
      ['a 403', () => Promise.reject(fetchError(403))],
      ['a response that is not a group list', () => Promise.resolve('<!doctype html>')],
    ])('falls back to the group endpoint on %s', async (_, root) => {
      respondTo({ '/apis': root, '/apis/dashboard.grafana.app/': () => Promise.resolve(dashboardGroup) });

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
      expect(requestedUrls()).toEqual(['/apis', '/apis/dashboard.grafana.app/']);
    });

    it('returns undefined when the group endpoint answers 404, and caches it', async () => {
      respondTo({ '/apis': () => Promise.reject(fetchError(500)) });

      await expect(getAPIGroup('annotation.grafana.app')).resolves.toBeUndefined();
      await expect(getAPIGroup('annotation.grafana.app')).resolves.toBeUndefined();

      expect(requestedUrls()).toEqual(['/apis', '/apis/annotation.grafana.app/']);
    });

    it('memoizes the group answer instead of retrying the root request for that group', async () => {
      respondTo({
        '/apis': () => Promise.reject(fetchError(500)),
        '/apis/dashboard.grafana.app/': () => Promise.resolve(dashboardGroup),
      });

      await getAPIGroup('dashboard.grafana.app');
      await getAPIGroup('dashboard.grafana.app');

      expect(requestedUrls()).toEqual(['/apis', '/apis/dashboard.grafana.app/']);
    });

    it('retries the root request for a group it has not answered yet', async () => {
      respondTo({ '/apis': () => Promise.reject(fetchError(500)) });
      await getAPIGroup('annotation.grafana.app');

      respondTo({ '/apis': () => Promise.resolve(groupList) });

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
      expect(requestedUrls()).toEqual(['/apis', '/apis/annotation.grafana.app/', '/apis']);
    });

    it('logs one event per failed request, not per caller', async () => {
      respondTo({ '/apis': () => Promise.reject(fetchError(500)) });

      await Promise.all([getAPIGroup('annotation.grafana.app'), getAPIGroup('annotation.grafana.app')]);

      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ url: '/apis', status: '500' })
      );
    });
  });

  describe('when discovery cannot answer', () => {
    it.each([
      ['a server error', 500],
      ['a 401', 401],
      ['a 403', 403],
    ])('returns undefined on %s, and retries on the next call', async (_, status) => {
      backendGet.mockRejectedValue(fetchError(status));

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();

      respondTo({ '/apis': () => Promise.resolve(groupList) });

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
      expect(requestedUrls()).toEqual(['/apis', '/apis/dashboard.grafana.app/', '/apis']);
    });

    it('logs both the failed root request and the failed group request', async () => {
      backendGet.mockRejectedValue(fetchError(500));

      await getAPIGroup('dashboard.grafana.app');

      expect(logError).toHaveBeenCalledTimes(2);
      expect(logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ url: '/apis/dashboard.grafana.app/' })
      );
    });

    it('treats a request that outlasts the timeout as unknown, and retries on the next call', async () => {
      jest.useFakeTimers();
      backendGet.mockReturnValue(new Promise(() => {}));

      const pending = getAPIGroup('dashboard.grafana.app');
      await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);
      await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);

      await expect(pending).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledTimes(2);
      expect(logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ reason: 'timeout' }));

      respondTo({ '/apis': () => Promise.resolve(groupList) });
      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
    });

    it('aborts a request that outlasts the timeout', async () => {
      jest.useFakeTimers();
      backendGet.mockReturnValue(new Promise(() => {}));

      const pending = getAPIGroup('dashboard.grafana.app');
      await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);

      const [, , , options] = backendGet.mock.calls[0];
      expect(options.abortSignal.aborted).toBe(true);

      await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);
      await pending;
    });
  });

  describe('without a user session', () => {
    it.each([
      ['no boot user', undefined],
      ['a boot user without an org role', { isSignedIn: false, orgRole: '' as const }],
    ])('returns undefined without a request for %s', async (_, user) => {
      setBootUser(user);

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
      expect(backendGet).not.toHaveBeenCalled();
      expect(logError).not.toHaveBeenCalled();
    });

    // Public dashboard viewers have no session, and `/apis` requires one.
    it('returns undefined without a request for a public dashboard viewer', async () => {
      setBootUser({ isSignedIn: false, orgRole: '' });
      config.publicDashboardAccessToken = 'public-token';

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
      expect(backendGet).not.toHaveBeenCalled();
    });

    it('requests the list once a session exists', async () => {
      setBootUser(undefined);
      await getAPIGroup('dashboard.grafana.app');

      setBootUser({ isSignedIn: false, orgRole: OrgRole.Viewer });
      respondTo({ '/apis': () => Promise.resolve(groupList) });

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
    });
  });

  it('returns undefined without a request for a group name that is not a valid API group', async () => {
    await expect(getAPIGroup('../api/admin')).resolves.toBeUndefined();
    expect(backendGet).not.toHaveBeenCalled();
  });

  it('warns about a group name that is not a valid API group', async () => {
    await getAPIGroup('Dashboard.grafana.app');

    expect(logWarning).toHaveBeenCalledWith(expect.stringContaining('not a valid API group name'), {
      group: 'Dashboard.grafana.app',
    });
  });

  it('does not warn about a valid group name', async () => {
    respondTo({ '/apis': () => Promise.resolve(groupList) });

    await getAPIGroup('annotation.grafana.app');

    expect(logWarning).not.toHaveBeenCalled();
  });
});

describe('setAPIDiscoveryForTesting', () => {
  it('answers from the given groups without a request or a session', async () => {
    setBootUser(undefined);
    setAPIDiscoveryForTesting([dashboardInfo]);

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
    await expect(getAPIGroup('annotation.grafana.app')).resolves.toBeUndefined();
    expect(backendGet).not.toHaveBeenCalled();
  });

  it('is cleared by invalidateAPIDiscovery()', async () => {
    setAPIDiscoveryForTesting([dashboardInfo]);
    invalidateAPIDiscovery();
    respondTo({ '/apis': () => Promise.resolve({ groups: [] }) });

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
    expect(requestedUrls()).toEqual(['/apis']);
  });
});

const DASHBOARD_V1_URL = '/apis/dashboard.grafana.app/v1beta1';
const ALL_VERBS = ['create', 'delete', 'deletecollection', 'get', 'list', 'patch', 'update', 'watch'];

const dashboardResourceList: K8sAPIResourceList = {
  groupVersion: 'dashboard.grafana.app/v1beta1',
  resources: [
    { name: 'dashboards', kind: 'Dashboard', namespaced: true, verbs: ALL_VERBS },
    { name: 'dashboards/dto', kind: 'DashboardWithAccessInfo', namespaced: true, verbs: ['get'] },
    { name: 'dashboards/status', kind: 'Dashboard', namespaced: true, verbs: ['get', 'patch', 'update'] },
    { name: 'snapshots', kind: 'Snapshot', namespaced: true, verbs: ['get', 'list'] },
  ],
};

const dashboardsInfo = {
  group: 'dashboard.grafana.app',
  version: 'v1beta1',
  resource: 'dashboards',
  kind: 'Dashboard',
  namespaced: true,
  verbs: ALL_VERBS,
  subresources: ['dto', 'status'],
};

const snapshotsInfo = {
  group: 'dashboard.grafana.app',
  version: 'v1beta1',
  resource: 'snapshots',
  kind: 'Snapshot',
  namespaced: true,
  verbs: ['get', 'list'],
  subresources: [],
};

describe('getAPIResources', () => {
  describe('when the group version is served', () => {
    beforeEach(() => {
      respondTo({
        '/apis': () => Promise.resolve(groupList),
        [DASHBOARD_V1_URL]: () => Promise.resolve(dashboardResourceList),
      });
    });

    it('returns the resources with their subresources folded in', async () => {
      await expect(getAPIResources('dashboard.grafana.app', 'v1beta1')).resolves.toEqual([
        dashboardsInfo,
        snapshotsInfo,
      ]);
    });

    it('requests the resource list without an error toast', async () => {
      await getAPIResources('dashboard.grafana.app', 'v1beta1');

      expect(backendGet).toHaveBeenCalledWith(
        DASHBOARD_V1_URL,
        undefined,
        undefined,
        expect.objectContaining({ showErrorAlert: false })
      );
    });

    it('caches the list per group version', async () => {
      respondTo({
        '/apis': () => Promise.resolve(groupList),
        [DASHBOARD_V1_URL]: () => Promise.resolve(dashboardResourceList),
        '/apis/dashboard.grafana.app/v0alpha1': () =>
          Promise.resolve({ groupVersion: 'dashboard.grafana.app/v0alpha1', resources: [] }),
      });

      await getAPIResources('dashboard.grafana.app', 'v1beta1');
      await getAPIResources('dashboard.grafana.app', 'v1beta1');
      await expect(getAPIResources('dashboard.grafana.app', 'v0alpha1')).resolves.toEqual([]);

      expect(requestedUrls()).toEqual(['/apis', DASHBOARD_V1_URL, '/apis/dashboard.grafana.app/v0alpha1']);
    });

    it('shares one in-flight request between concurrent callers', async () => {
      const results = await Promise.all([
        getAPIResources('dashboard.grafana.app', 'v1beta1'),
        getAPIResources('dashboard.grafana.app', 'v1beta1'),
        isAPIResourceAvailable({ group: 'dashboard.grafana.app', version: 'v1beta1', resource: 'dashboards' }),
      ]);

      expect(results).toEqual([[dashboardsInfo, snapshotsInfo], [dashboardsInfo, snapshotsInfo], true]);
      expect(requestedUrls()).toEqual(['/apis', DASHBOARD_V1_URL]);
    });

    it('requests the list again after invalidateAPIDiscovery()', async () => {
      await getAPIResources('dashboard.grafana.app', 'v1beta1');
      invalidateAPIDiscovery();
      await getAPIResources('dashboard.grafana.app', 'v1beta1');

      expect(requestedUrls()).toEqual(['/apis', DASHBOARD_V1_URL, '/apis', DASHBOARD_V1_URL]);
    });
  });

  describe('when the group version is not served', () => {
    beforeEach(() => {
      respondTo({ '/apis': () => Promise.resolve(groupList) });
    });

    it.each([
      ['a group the server does not list', 'annotation.grafana.app', 'v0alpha1'],
      ['a version the group does not list', 'dashboard.grafana.app', 'v2beta1'],
    ])('returns undefined without a resource request for %s', async (_, group, version) => {
      await expect(getAPIResources(group, version)).resolves.toBeUndefined();
      expect(requestedUrls()).toEqual(['/apis']);
    });

    it('returns undefined when the resource list answers 404, and caches it', async () => {
      await expect(getAPIResources('dashboard.grafana.app', 'v1beta1')).resolves.toBeUndefined();
      await expect(getAPIResources('dashboard.grafana.app', 'v1beta1')).resolves.toBeUndefined();

      expect(requestedUrls()).toEqual(['/apis', DASHBOARD_V1_URL]);
      expect(logError).not.toHaveBeenCalled();
    });
  });

  describe('when discovery cannot answer', () => {
    it.each([
      ['a server error', () => Promise.reject(fetchError(500))],
      ['a 403', () => Promise.reject(fetchError(403))],
      ['a response that is not a resource list', () => Promise.resolve('<!doctype html>')],
    ])('returns undefined on %s, logs it, and retries on the next call', async (_, resourceList) => {
      respondTo({ '/apis': () => Promise.resolve(groupList), [DASHBOARD_V1_URL]: resourceList });

      await expect(getAPIResources('dashboard.grafana.app', 'v1beta1')).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ url: DASHBOARD_V1_URL }));

      respondTo({
        '/apis': () => Promise.resolve(groupList),
        [DASHBOARD_V1_URL]: () => Promise.resolve(dashboardResourceList),
      });

      await expect(getAPIResources('dashboard.grafana.app', 'v1beta1')).resolves.toEqual([
        dashboardsInfo,
        snapshotsInfo,
      ]);
      expect(requestedUrls()).toEqual(['/apis', DASHBOARD_V1_URL, DASHBOARD_V1_URL]);
    });

    it('treats a request that outlasts the timeout as unknown', async () => {
      jest.useFakeTimers();
      respondTo({ '/apis': () => Promise.resolve(groupList), [DASHBOARD_V1_URL]: () => new Promise(() => {}) });

      const pending = getAPIResources('dashboard.grafana.app', 'v1beta1');
      await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);

      await expect(pending).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ reason: 'timeout' }));
    });

    it('returns undefined without a request when there is no session', async () => {
      setBootUser(undefined);
      setAPIDiscoveryForTesting([dashboardInfo]);

      await expect(getAPIResources('dashboard.grafana.app', 'v1beta1')).resolves.toBeUndefined();
      expect(backendGet).not.toHaveBeenCalled();
    });
  });
});

describe('isAPIResourceAvailable', () => {
  const dashboards = { group: 'dashboard.grafana.app', version: 'v1beta1', resource: 'dashboards' };

  beforeEach(() => {
    respondTo({
      '/apis': () => Promise.resolve(groupList),
      [DASHBOARD_V1_URL]: () => Promise.resolve(dashboardResourceList),
    });
  });

  it.each([
    ['a served resource', dashboards, true],
    ['a resource the group version does not list', { ...dashboards, resource: 'librarypanels' }, false],
    ['a resource in a version that is not served', { ...dashboards, version: 'v2beta1' }, false],
    ['a served subresource', { ...dashboards, subresource: 'dto' }, true],
    ['a subresource the resource does not list', { ...dashboards, subresource: 'history' }, false],
    // App plugin routes are custom routes, not subresources, so discovery does not list them.
    ['an app plugin route', { ...dashboards, subresource: 'proxy' }, false],
    ['a verb the resource lists', { ...dashboards, verb: 'watch' }, true],
    ['a verb the resource does not list', { ...dashboards, resource: 'snapshots', verb: 'delete' }, false],
    ['a verb the subresource lists', { ...dashboards, subresource: 'status', verb: 'patch' }, true],
    ['a verb only the parent resource lists', { ...dashboards, subresource: 'dto', verb: 'delete' }, false],
  ])('answers %s with %s', async (_, query, expected) => {
    await expect(isAPIResourceAvailable(query)).resolves.toBe(expected);
  });

  it('returns false when discovery cannot answer', async () => {
    respondTo({ '/apis': () => Promise.resolve(groupList), [DASHBOARD_V1_URL]: () => Promise.reject(fetchError(500)) });

    await expect(isAPIResourceAvailable(dashboards)).resolves.toBe(false);
  });
});

describe('getAllAPIResources', () => {
  const aggregatedList: K8sAPIGroupDiscoveryList = {
    items: [
      {
        metadata: { name: 'dashboard.grafana.app' },
        versions: [
          {
            version: 'v1beta1',
            resources: [
              {
                resource: 'dashboards',
                responseKind: { kind: 'Dashboard' },
                scope: 'Namespaced',
                verbs: ALL_VERBS,
                subresources: [
                  { subresource: 'dto', verbs: ['get'] },
                  { subresource: 'status', verbs: ['get', 'patch', 'update'] },
                ],
              },
              {
                resource: 'snapshots',
                responseKind: { kind: 'Snapshot' },
                scope: 'Namespaced',
                verbs: ['get', 'list'],
              },
            ],
          },
          {
            version: 'v0alpha1',
            resources: [
              {
                resource: 'librarypanels',
                responseKind: { kind: 'LibraryPanel' },
                scope: 'Namespaced',
                verbs: ['get'],
              },
            ],
          },
        ],
      },
      {
        metadata: { name: 'iam.grafana.app' },
        versions: [
          {
            version: 'v0alpha1',
            resources: [
              {
                resource: 'globalroles',
                responseKind: { kind: 'GlobalRole' },
                scope: 'Cluster',
                verbs: ['get', 'list'],
              },
            ],
          },
        ],
      },
    ],
  };

  describe('when the aggregated request succeeds', () => {
    beforeEach(() => {
      respondTo({
        [AGGREGATED_ROUTE]: () => Promise.resolve(aggregatedList),
        '/apis': () => Promise.resolve(groupList),
      });
    });

    it('returns the resources of every group and version, preferred or not', async () => {
      await expect(getAllAPIResources()).resolves.toEqual([
        dashboardsInfo,
        snapshotsInfo,
        {
          group: 'dashboard.grafana.app',
          version: 'v0alpha1',
          resource: 'librarypanels',
          kind: 'LibraryPanel',
          namespaced: true,
          verbs: ['get'],
          subresources: [],
        },
        {
          group: 'iam.grafana.app',
          version: 'v0alpha1',
          resource: 'globalroles',
          kind: 'GlobalRole',
          namespaced: false,
          verbs: ['get', 'list'],
          subresources: [],
        },
      ]);
    });

    it('asks /apis for the aggregated list without an error toast', async () => {
      await getAllAPIResources();

      expect(backendGet).toHaveBeenCalledWith(
        '/apis',
        undefined,
        undefined,
        expect.objectContaining({
          showErrorAlert: false,
          headers: {
            Accept:
              'application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json',
          },
        })
      );
    });

    it('caches the list separately from the group list', async () => {
      await getAPIGroup('dashboard.grafana.app');
      await getAllAPIResources();
      await getAllAPIResources();
      await getAPIGroup('dashboard.grafana.app');

      expect(requestedUrls()).toEqual(['/apis', AGGREGATED_ROUTE]);
    });

    it('shares one in-flight request between concurrent callers', async () => {
      await Promise.all([getAllAPIResources(), getAllAPIResources()]);

      expect(requestedUrls()).toEqual([AGGREGATED_ROUTE]);
    });

    it('requests the list again after invalidateAPIDiscovery()', async () => {
      await getAllAPIResources();
      invalidateAPIDiscovery();
      await getAllAPIResources();

      expect(requestedUrls()).toEqual([AGGREGATED_ROUTE, AGGREGATED_ROUTE]);
    });

    it('uses an empty kind when the server names no response kind', async () => {
      respondTo({
        [AGGREGATED_ROUTE]: () =>
          Promise.resolve({
            items: [
              {
                metadata: { name: 'x.grafana.app' },
                versions: [{ version: 'v1', resources: [{ resource: 'things', scope: 'Cluster', verbs: [] }] }],
              },
            ],
          }),
      });

      await expect(getAllAPIResources()).resolves.toEqual([
        {
          group: 'x.grafana.app',
          version: 'v1',
          resource: 'things',
          kind: '',
          namespaced: false,
          verbs: [],
          subresources: [],
        },
      ]);
    });
  });

  describe('when discovery cannot answer', () => {
    it.each([
      ['a server error', () => Promise.reject(fetchError(500))],
      ['a 404', () => Promise.reject(fetchError(404))],
      // A server without aggregated discovery answers with the plain group list.
      ['a plain group list', () => Promise.resolve(groupList)],
    ])('returns undefined on %s, logs it, and retries on the next call', async (_, aggregated) => {
      respondTo({ [AGGREGATED_ROUTE]: aggregated });

      await expect(getAllAPIResources()).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ url: '/apis' }));

      respondTo({ [AGGREGATED_ROUTE]: () => Promise.resolve(aggregatedList) });

      await expect(getAllAPIResources()).resolves.toHaveLength(4);
      expect(requestedUrls()).toEqual([AGGREGATED_ROUTE, AGGREGATED_ROUTE]);
    });

    it('returns undefined without a request when there is no session', async () => {
      setBootUser(undefined);

      await expect(getAllAPIResources()).resolves.toBeUndefined();
      expect(backendGet).not.toHaveBeenCalled();
    });
  });
});

// Kubernetes writes an empty list as `null`, and leaves out the aggregated fields marked `omitempty`.
describe('responses shaped the way Kubernetes writes them', () => {
  it('reads null resource and verb lists from GET /apis/<group>/<version> as empty', async () => {
    respondTo({
      '/apis': () => Promise.resolve(groupList),
      [DASHBOARD_V1_URL]: () =>
        Promise.resolve({
          groupVersion: 'dashboard.grafana.app/v1beta1',
          resources: [{ name: 'snapshots', kind: 'Snapshot', namespaced: true, verbs: null }],
        }),
      '/apis/dashboard.grafana.app/v0alpha1': () =>
        Promise.resolve({ groupVersion: 'dashboard.grafana.app/v0alpha1', resources: null }),
    });

    await expect(getAPIResources('dashboard.grafana.app', 'v1beta1')).resolves.toEqual([
      { ...snapshotsInfo, verbs: [] },
    ]);
    await expect(getAPIResources('dashboard.grafana.app', 'v0alpha1')).resolves.toEqual([]);
    expect(logError).not.toHaveBeenCalled();
  });

  it('reads an aggregated list with omitted and null fields', async () => {
    respondTo({
      [AGGREGATED_ROUTE]: () =>
        Promise.resolve({
          items: [
            {
              metadata: { name: 'quotas.grafana.app' },
              // A version that serves routes only has no resources field.
              versions: [{ version: 'v0alpha1', freshness: 'Current' }],
            },
            { metadata: { name: 'empty.grafana.app' } },
            {
              metadata: { name: 'dashboard.grafana.app' },
              versions: [
                {
                  version: 'v1beta1',
                  resources: [
                    {
                      resource: 'dashboards',
                      scope: 'Namespaced',
                      verbs: null,
                      subresources: [{ subresource: 'dto', verbs: null }],
                    },
                  ],
                },
              ],
            },
          ],
        }),
    });

    await expect(getAllAPIResources()).resolves.toEqual([
      { ...dashboardsInfo, kind: '', verbs: [], subresources: ['dto'] },
    ]);
    expect(logError).not.toHaveBeenCalled();
  });

  it('reads a null aggregated list as empty', async () => {
    respondTo({ [AGGREGATED_ROUTE]: () => Promise.resolve({ items: null }) });

    await expect(getAllAPIResources()).resolves.toEqual([]);
  });

  it('still rejects a response without a resource list', async () => {
    respondTo({
      '/apis': () => Promise.resolve(groupList),
      [DASHBOARD_V1_URL]: () => Promise.resolve({ kind: 'Status' }),
    });

    await expect(getAPIResources('dashboard.grafana.app', 'v1beta1')).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

describe('getAllAPIResources with a stale version', () => {
  // The router marks a version stale when it couldn't read its backend, and lists the resources it last knew of.
  const staleList = {
    items: [
      {
        metadata: { name: 'dashboard.grafana.app' },
        versions: [
          {
            version: 'v1beta1',
            freshness: 'Stale',
            resources: [
              {
                resource: 'snapshots',
                responseKind: { kind: 'Snapshot' },
                scope: 'Namespaced',
                verbs: ['get', 'list'],
              },
            ],
          },
        ],
      },
    ],
  };

  it('returns the resources the server last knew of', async () => {
    respondTo({ [AGGREGATED_ROUTE]: () => Promise.resolve(staleList) });

    await expect(getAllAPIResources()).resolves.toEqual([snapshotsInfo]);
    expect(logError).not.toHaveBeenCalled();
  });

  it('does not keep the answer, so the next call asks again', async () => {
    respondTo({ [AGGREGATED_ROUTE]: () => Promise.resolve(staleList) });
    await getAllAPIResources();

    const fresh = {
      items: [{ ...staleList.items[0], versions: [{ ...staleList.items[0].versions[0], freshness: 'Current' }] }],
    };
    respondTo({ [AGGREGATED_ROUTE]: () => Promise.resolve(fresh) });
    await getAllAPIResources();
    await getAllAPIResources();

    expect(requestedUrls()).toEqual([AGGREGATED_ROUTE, AGGREGATED_ROUTE]);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    respondTo({ [AGGREGATED_ROUTE]: () => Promise.resolve(staleList) });

    await Promise.all([getAllAPIResources(), getAllAPIResources()]);

    expect(requestedUrls()).toEqual([AGGREGATED_ROUTE]);
  });
});
