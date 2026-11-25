import { from, map, NEVER, Observable, throwError } from 'rxjs';

import { type CurrentUserDTO, OrgRole } from '@grafana/data';
import { mockLogger } from '@grafana/test-utils/unstable';

import { config } from '../../config';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, type BackendSrvRequest, type FetchError, setBackendSrv } from '../backendSrv';

import { API_DISCOVERY_TIMEOUT_MS, getAPIGroup, invalidateAPIDiscovery, setAPIDiscoveryForTesting } from './discovery';
import { type K8sAPIGroup, type K8sAPIGroupList } from './types';

const backendFetch = jest.fn<Observable<{ data: unknown }>, [BackendSrvRequest]>();
let logger: MonitoringLogger;
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
  backendFetch.mockImplementation(({ url }) => {
    const route = routes[url];
    return from(route ? route() : Promise.reject(fetchError(404))).pipe(map((data) => ({ data })));
  });
}

function failWith(status: number) {
  backendFetch.mockImplementation(() => throwError(() => fetchError(status)));
}

function requestedUrls(): string[] {
  return backendFetch.mock.calls.map(([{ url }]) => url);
}

beforeEach(() => {
  jest.clearAllMocks();
  invalidateAPIDiscovery();
  setBackendSrv({ fetch: backendFetch } as unknown as BackendSrv);
  logger = mockLogger('grafana/runtime.apis.discovery');
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

    it('requests the plain group list without an error toast, validating the path', async () => {
      await getAPIGroup('dashboard.grafana.app');

      expect(backendFetch).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/apis', method: 'GET', showErrorAlert: false, validatePath: true })
      );
    });

    it('returns undefined for a group the server does not list, without logging', async () => {
      await expect(getAPIGroup('annotation.grafana.app')).resolves.toBeUndefined();
      expect(logger.logError).not.toHaveBeenCalled();
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
      ['a group list with a malformed group', () => Promise.resolve({ groups: [{ name: 'x', versions: [null] }] })],
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

    it('treats a malformed group endpoint answer as unknown', async () => {
      respondTo({
        '/apis': () => Promise.reject(fetchError(500)),
        '/apis/dashboard.grafana.app/': () => Promise.resolve({ name: 'dashboard.grafana.app', versions: [null] }),
      });

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
      expect(logger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ url: '/apis/dashboard.grafana.app/' })
      );
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

    it('requests the group again after invalidateAPIDiscovery()', async () => {
      respondTo({
        '/apis': () => Promise.reject(fetchError(500)),
        '/apis/dashboard.grafana.app/': () => Promise.resolve(dashboardGroup),
      });
      await getAPIGroup('dashboard.grafana.app');

      invalidateAPIDiscovery();
      await getAPIGroup('dashboard.grafana.app');

      expect(requestedUrls()).toEqual([
        '/apis',
        '/apis/dashboard.grafana.app/',
        '/apis',
        '/apis/dashboard.grafana.app/',
      ]);
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

      expect(logger.logError).toHaveBeenCalledTimes(1);
      expect(logger.logError).toHaveBeenCalledWith(
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
      failWith(status);

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();

      respondTo({ '/apis': () => Promise.resolve(groupList) });

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
      expect(requestedUrls()).toEqual(['/apis', '/apis/dashboard.grafana.app/', '/apis']);
    });

    it('logs both the failed root request and the failed group request', async () => {
      failWith(500);

      await getAPIGroup('dashboard.grafana.app');

      expect(logger.logError).toHaveBeenCalledTimes(2);
      expect(logger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ url: '/apis/dashboard.grafana.app/' })
      );
    });

    it('logs a failed request only to the discovery logger', async () => {
      const cacheLogger = mockLogger('grafana/runtime.utils.getCachedPromise');
      failWith(500);

      await getAPIGroup('dashboard.grafana.app');

      expect(cacheLogger.logError).not.toHaveBeenCalled();
    });

    it('treats a request that outlasts the timeout as unknown, and retries on the next call', async () => {
      jest.useFakeTimers();
      backendFetch.mockReturnValue(NEVER);

      const pending = getAPIGroup('dashboard.grafana.app');
      await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);
      await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);

      await expect(pending).resolves.toBeUndefined();
      expect(logger.logError).toHaveBeenCalledTimes(2);
      expect(logger.logError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ reason: 'timeout' }));

      respondTo({ '/apis': () => Promise.resolve(groupList) });
      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
    });

    it('cancels a request that outlasts the timeout', async () => {
      jest.useFakeTimers();
      const cancel = jest.fn();
      backendFetch.mockReturnValue(new Observable(() => cancel));

      const pending = getAPIGroup('dashboard.grafana.app');
      await jest.advanceTimersByTimeAsync(API_DISCOVERY_TIMEOUT_MS);

      expect(cancel).toHaveBeenCalledTimes(1);

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
      expect(backendFetch).not.toHaveBeenCalled();
      expect(logger.logError).not.toHaveBeenCalled();
    });

    // Public dashboard viewers have no session, and `/apis` requires one.
    it('returns undefined without a request for a public dashboard viewer', async () => {
      setBootUser({ isSignedIn: false, orgRole: '' });
      config.publicDashboardAccessToken = 'public-token';

      await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
      expect(backendFetch).not.toHaveBeenCalled();
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
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('warns about a group name that is not a valid API group', async () => {
    await getAPIGroup('Dashboard.grafana.app');

    expect(logger.logWarning).toHaveBeenCalledWith(expect.stringContaining('not a valid API group name'), {
      group: 'Dashboard.grafana.app',
    });
  });

  it('does not warn about a valid group name', async () => {
    respondTo({ '/apis': () => Promise.resolve(groupList) });

    await getAPIGroup('annotation.grafana.app');

    expect(logger.logWarning).not.toHaveBeenCalled();
  });
});

describe('setAPIDiscoveryForTesting', () => {
  it('answers from the given groups without a request or a session', async () => {
    setBootUser(undefined);
    setAPIDiscoveryForTesting([dashboardInfo]);

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toEqual(dashboardInfo);
    await expect(getAPIGroup('annotation.grafana.app')).resolves.toBeUndefined();
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('is cleared by invalidateAPIDiscovery()', async () => {
    setAPIDiscoveryForTesting([dashboardInfo]);
    invalidateAPIDiscovery();
    respondTo({ '/apis': () => Promise.resolve({ groups: [] }) });

    await expect(getAPIGroup('dashboard.grafana.app')).resolves.toBeUndefined();
    expect(requestedUrls()).toEqual(['/apis']);
  });
});
