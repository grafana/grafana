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
import { type K8sAPIGroup, type K8sAPIGroupDiscovery, type K8sAPIGroupList, type K8sAPIResourceList } from './types';

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

function respondTo(routes: Record<string, () => Promise<unknown>>) {
  backendGet.mockImplementation((url: string) => {
    const route = routes[url];
    return route ? route() : Promise.reject(fetchError(404));
  });
}

function requestedUrls(): string[] {
  return backendGet.mock.calls.map(([url]) => url);
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

const FOLDER_RESOURCES_URL = '/apis/folder.grafana.app/v1beta1';

const folderResourceList: K8sAPIResourceList = {
  resources: [
    {
      name: 'folders',
      namespaced: true,
      kind: 'Folder',
      verbs: ['create', 'delete', 'get', 'list', 'patch', 'update'],
    },
    { name: 'folders/access', namespaced: true, kind: 'FolderAccessInfo', verbs: ['get'] },
  ],
};

const foldersInfo = {
  group: 'folder.grafana.app',
  version: 'v1beta1',
  resource: 'folders',
  kind: 'Folder',
  namespaced: true,
  verbs: ['create', 'delete', 'get', 'list', 'patch', 'update'],
  subresources: ['access'],
};

describe('getAPIResources', () => {
  describe('when the group version is served', () => {
    beforeEach(() => {
      respondTo({ [FOLDER_RESOURCES_URL]: () => Promise.resolve(folderResourceList) });
    });

    it('returns its resources', async () => {
      await expect(getAPIResources('folder.grafana.app', 'v1beta1')).resolves.toEqual([foldersInfo]);
    });

    it('requests the resource list without an error toast', async () => {
      await getAPIResources('folder.grafana.app', 'v1beta1');

      expect(backendGet).toHaveBeenCalledWith(
        FOLDER_RESOURCES_URL,
        undefined,
        undefined,
        expect.objectContaining({ showErrorAlert: false })
      );
    });

    it('caches the list per group version', async () => {
      await getAPIResources('folder.grafana.app', 'v1beta1');
      await getAPIResources('folder.grafana.app', 'v1');
      await getAPIResources('folder.grafana.app', 'v1beta1');
      await getAPIResources('folder.grafana.app', 'v1');

      expect(requestedUrls()).toEqual([FOLDER_RESOURCES_URL, '/apis/folder.grafana.app/v1']);
    });

    it('shares one in-flight request between concurrent callers', async () => {
      const results = await Promise.all([
        getAPIResources('folder.grafana.app', 'v1beta1'),
        getAPIResources('folder.grafana.app', 'v1beta1'),
        isAPIResourceAvailable({ group: 'folder.grafana.app', version: 'v1beta1', resource: 'folders' }),
      ]);

      expect(results).toEqual([[foldersInfo], [foldersInfo], true]);
      expect(requestedUrls()).toEqual([FOLDER_RESOURCES_URL]);
    });

    it('requests the list again after invalidateAPIDiscovery()', async () => {
      await getAPIResources('folder.grafana.app', 'v1beta1');
      invalidateAPIDiscovery();
      await getAPIResources('folder.grafana.app', 'v1beta1');

      expect(requestedUrls()).toEqual([FOLDER_RESOURCES_URL, FOLDER_RESOURCES_URL]);
    });
  });

  it('returns no resources for a group version whose list is empty, caches it, and does not log', async () => {
    const empty = { kind: 'APIResourceList', groupVersion: 'folder.grafana.app/v1beta1', resources: null };
    respondTo({ [FOLDER_RESOURCES_URL]: () => Promise.resolve(empty) });

    await expect(getAPIResources('folder.grafana.app', 'v1beta1')).resolves.toEqual([]);
    await expect(
      isAPIResourceAvailable({ group: 'folder.grafana.app', version: 'v1beta1', resource: 'folders' })
    ).resolves.toBe(false);

    expect(requestedUrls()).toEqual([FOLDER_RESOURCES_URL]);
    expect(logError).not.toHaveBeenCalled();
  });

  it('returns undefined when the server has no list for the group version, caches it, and does not log', async () => {
    respondTo({});

    await expect(getAPIResources('folder.grafana.app', 'v1beta1')).resolves.toBeUndefined();
    await expect(getAPIResources('folder.grafana.app', 'v1beta1')).resolves.toBeUndefined();

    expect(requestedUrls()).toEqual([FOLDER_RESOURCES_URL]);
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([
    ['a server error', () => Promise.reject(fetchError(500))],
    ['a 401', () => Promise.reject(fetchError(401))],
    ['a 403', () => Promise.reject(fetchError(403))],
    ['a response that is not a resource list', () => Promise.resolve('<!doctype html>')],
  ])('returns undefined on %s, logs it once, and retries on the next call', async (_, answer) => {
    respondTo({ [FOLDER_RESOURCES_URL]: answer });

    const results = await Promise.all([
      getAPIResources('folder.grafana.app', 'v1beta1'),
      getAPIResources('folder.grafana.app', 'v1beta1'),
    ]);

    expect(results).toEqual([undefined, undefined]);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ url: FOLDER_RESOURCES_URL }));

    respondTo({ [FOLDER_RESOURCES_URL]: () => Promise.resolve(folderResourceList) });

    await expect(getAPIResources('folder.grafana.app', 'v1beta1')).resolves.toEqual([foldersInfo]);
    expect(requestedUrls()).toEqual([FOLDER_RESOURCES_URL, FOLDER_RESOURCES_URL]);
  });

  it('treats a request that outlasts the timeout as unknown', async () => {
    jest.useFakeTimers();
    backendGet.mockReturnValue(new Promise(() => {}));

    const pending = getAPIResources('folder.grafana.app', 'v1beta1');
    await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);

    await expect(pending).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ reason: 'timeout' }));
  });

  it('returns undefined without a request when there is no session', async () => {
    setBootUser(undefined);

    await expect(getAPIResources('folder.grafana.app', 'v1beta1')).resolves.toBeUndefined();
    expect(backendGet).not.toHaveBeenCalled();
  });

  it.each([
    ['../api', 'v1'],
    ['folder.grafana.app', '../v1'],
    ['folder.grafana.app', 'v1/folders'],
    ['folder.grafana.app', ''],
  ])(
    'returns undefined without a request for %s and %s, which are not a group and a version',
    async (group, version) => {
      await expect(getAPIResources(group, version)).resolves.toBeUndefined();
      expect(backendGet).not.toHaveBeenCalled();
      expect(logWarning).toHaveBeenCalledTimes(1);
    }
  );

  it('warns about a version that is not an API version', async () => {
    await getAPIResources('folder.grafana.app', 'beta1');

    expect(logWarning).toHaveBeenCalledWith(expect.stringContaining('not a valid API version'), {
      group: 'folder.grafana.app',
      version: 'beta1',
    });
  });

  it('does not warn about a valid group and version', async () => {
    respondTo({});

    await getAPIResources('folder.grafana.app', 'v1beta1');

    expect(logWarning).not.toHaveBeenCalled();
  });
});

describe('isAPIResourceAvailable', () => {
  const folders = { group: 'folder.grafana.app', version: 'v1beta1', resource: 'folders' };

  beforeEach(() => {
    respondTo({ [FOLDER_RESOURCES_URL]: () => Promise.resolve(folderResourceList) });
  });

  it('is true for a served resource', async () => {
    await expect(isAPIResourceAvailable(folders)).resolves.toBe(true);
  });

  it('checks the verb on the resource', async () => {
    await expect(isAPIResourceAvailable({ ...folders, verb: 'create' })).resolves.toBe(true);
    await expect(isAPIResourceAvailable({ ...folders, verb: 'watch' })).resolves.toBe(false);
  });

  it('checks the verb on the subresource, which has verbs of its own', async () => {
    await expect(isAPIResourceAvailable({ ...folders, subresource: 'access' })).resolves.toBe(true);
    await expect(isAPIResourceAvailable({ ...folders, subresource: 'access', verb: 'get' })).resolves.toBe(true);
    await expect(isAPIResourceAvailable({ ...folders, subresource: 'access', verb: 'update' })).resolves.toBe(false);
  });

  it('is false for a resource or subresource the group version does not serve', async () => {
    await expect(isAPIResourceAvailable({ ...folders, resource: 'dashboards' })).resolves.toBe(false);
    await expect(isAPIResourceAvailable({ ...folders, subresource: 'proxy' })).resolves.toBe(false);
  });

  it('is false when the group version is not served, or discovery cannot answer', async () => {
    respondTo({ '/apis/folder.grafana.app/v1': () => Promise.reject(fetchError(500)) });

    await expect(isAPIResourceAvailable({ ...folders, version: 'v2' })).resolves.toBe(false);
    await expect(isAPIResourceAvailable({ ...folders, version: 'v1' })).resolves.toBe(false);
  });

  it('shares requests and answers with getAPIResources', async () => {
    await getAPIResources('folder.grafana.app', 'v1beta1');
    await isAPIResourceAvailable({ ...folders, verb: 'list' });
    await isAPIResourceAvailable({ ...folders, subresource: 'access' });

    expect(requestedUrls()).toEqual([FOLDER_RESOURCES_URL]);
  });
});

const AGGREGATED_ACCEPT =
  'application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json';

const discoveryList: { items: K8sAPIGroupDiscovery[] } = {
  items: [
    {
      metadata: { name: 'dashboard.grafana.app' },
      versions: [
        {
          version: 'v1beta1',
          freshness: 'Current',
          resources: [
            {
              resource: 'dashboards',
              responseKind: { kind: 'Dashboard' },
              scope: 'Namespaced',
              verbs: ['get', 'list'],
              subresources: [{ subresource: 'dto', verbs: ['get'] }],
            },
          ],
        },
      ],
    },
    { metadata: { name: 'quotas.grafana.app' }, versions: [{ version: 'v0alpha1', freshness: 'Current' }] },
  ],
};

const dashboardsInfo = {
  group: 'dashboard.grafana.app',
  version: 'v1beta1',
  resource: 'dashboards',
  kind: 'Dashboard',
  namespaced: true,
  verbs: ['get', 'list'],
  subresources: ['dto'],
};

const staleGroup = {
  metadata: { name: 'example.ext.grafana.app' },
  versions: [
    {
      version: 'v1',
      freshness: 'Stale',
      resources: [{ resource: 'widgets', responseKind: { kind: 'Widget' }, scope: 'Namespaced', verbs: ['list'] }],
    },
  ],
};

function respondToAggregated(answer: () => Promise<unknown>) {
  backendGet.mockImplementation((url: string, _params, _requestId, options?: { headers?: Record<string, string> }) => {
    if (url !== '/apis') {
      return Promise.reject(fetchError(404));
    }
    return options?.headers?.Accept === AGGREGATED_ACCEPT ? answer() : Promise.resolve(groupList);
  });
}

function requestedFormats(): string[] {
  return backendGet.mock.calls.map(([url, , , options]) => (options?.headers ? `${url} aggregated` : url));
}

describe('getAllAPIResources', () => {
  describe('when the server serves aggregated discovery', () => {
    beforeEach(() => {
      respondToAggregated(() => Promise.resolve(discoveryList));
    });

    it('returns every resource by group and version', async () => {
      await expect(getAllAPIResources()).resolves.toEqual([dashboardsInfo]);
    });

    it('requests aggregated discovery from /apis without an error toast', async () => {
      await getAllAPIResources();

      expect(backendGet).toHaveBeenCalledWith(
        '/apis',
        undefined,
        undefined,
        expect.objectContaining({ showErrorAlert: false, headers: { Accept: AGGREGATED_ACCEPT } })
      );
    });

    it('caches the answer apart from the group list', async () => {
      await getAllAPIResources();
      await getAPIGroup('dashboard.grafana.app');
      await getAllAPIResources();
      await getAPIGroup('dashboard.grafana.app');

      expect(requestedFormats()).toEqual(['/apis aggregated', '/apis']);
    });

    it('shares one in-flight request between concurrent callers', async () => {
      const results = await Promise.all([getAllAPIResources(), getAllAPIResources(), getAllAPIResources()]);

      expect(results).toEqual([[dashboardsInfo], [dashboardsInfo], [dashboardsInfo]]);
      expect(requestedFormats()).toEqual(['/apis aggregated']);
    });

    it('requests it again after invalidateAPIDiscovery()', async () => {
      await getAllAPIResources();
      invalidateAPIDiscovery();
      await getAllAPIResources();

      expect(requestedFormats()).toEqual(['/apis aggregated', '/apis aggregated']);
    });
  });

  it('returns what a stale version lists without caching it, until no version is stale', async () => {
    respondToAggregated(() => Promise.resolve({ items: [...discoveryList.items, staleGroup] }));

    await expect(getAllAPIResources()).resolves.toEqual([
      dashboardsInfo,
      {
        group: 'example.ext.grafana.app',
        version: 'v1',
        resource: 'widgets',
        kind: 'Widget',
        namespaced: true,
        verbs: ['list'],
        subresources: [],
      },
    ]);

    respondToAggregated(() => Promise.resolve(discoveryList));

    await expect(getAllAPIResources()).resolves.toEqual([dashboardsInfo]);
    await expect(getAllAPIResources()).resolves.toEqual([dashboardsInfo]);
    expect(requestedFormats()).toEqual(['/apis aggregated', '/apis aggregated']);
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([
    ['a server error', () => Promise.reject(fetchError(500))],
    ['a 401', () => Promise.reject(fetchError(401))],
    ['a group list, as a server without aggregated discovery answers', () => Promise.resolve(groupList)],
    ['a response that is not a discovery list', () => Promise.resolve('<!doctype html>')],
  ])('returns undefined on %s, logs it once, and retries on the next call', async (_, answer) => {
    respondToAggregated(answer);

    const results = await Promise.all([getAllAPIResources(), getAllAPIResources()]);

    expect(results).toEqual([undefined, undefined]);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ url: '/apis', format: 'aggregated' })
    );

    respondToAggregated(() => Promise.resolve(discoveryList));

    await expect(getAllAPIResources()).resolves.toEqual([dashboardsInfo]);
    expect(requestedFormats()).toEqual(['/apis aggregated', '/apis aggregated']);
  });

  it('treats a request that outlasts the timeout as unknown', async () => {
    jest.useFakeTimers();
    backendGet.mockReturnValue(new Promise(() => {}));

    const pending = getAllAPIResources();
    await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);

    await expect(pending).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ reason: 'timeout' }));
  });

  it('returns undefined without a request when there is no session', async () => {
    setBootUser(undefined);

    await expect(getAllAPIResources()).resolves.toBeUndefined();
    expect(backendGet).not.toHaveBeenCalled();
  });
});
