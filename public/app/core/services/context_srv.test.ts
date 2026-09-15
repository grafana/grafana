import { getBackendSrv } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import config from '../config';

import { ContextSrv, contextSrv } from './context_srv';
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

describe('session heartbeat', () => {
  const originalUser = config.bootData.user;
  const originalInterval = config.sessionHeartbeatInterval;
  const originalLocation = window.location;
  let fetchMock: jest.SpyInstance;
  const reloadMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    config.bootData.user = { ...originalUser, isSignedIn: true };
    config.sessionHeartbeatInterval = 300000;
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ status: 200 } as Response);
    reloadMock.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
  });

  afterEach(() => {
    config.bootData.user = originalUser;
    config.sessionHeartbeatInterval = originalInterval;
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps an open session active at the server-supplied interval without reloading', async () => {
    const context = new ContextSrv();
    await jest.advanceTimersByTimeAsync(299999);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledWith(config.appSubUrl + '/api/login/ping', {
      method: 'GET',
      cache: 'no-store',
    });
    await jest.advanceTimersByTimeAsync(300000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(context.isSignedIn).toBe(true);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it.each([undefined, 0, -1, NaN])('does not schedule without a usable interval (%s)', async (interval) => {
    config.sessionHeartbeatInterval = interval;
    const context = new ContextSrv();
    await jest.advanceTimersByTimeAsync(900000);
    expect(context.isSignedIn).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('does not check a signed-out session', async () => {
    config.bootData.user.isSignedIn = false;
    const context = new ContextSrv();
    await jest.advanceTimersByTimeAsync(900000);
    expect(context.isSignedIn).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it.each(['network', 'server'])('retries after a %s error without logging out', async (failure) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    if (failure === 'network') {
      fetchMock.mockRejectedValueOnce(new Error('offline'));
    } else {
      fetchMock.mockResolvedValueOnce({ status: 503 } as Response);
    }
    const context = new ContextSrv();
    await jest.advanceTimersByTimeAsync(600000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(context.isSignedIn).toBe(true);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('logs out and stops heartbeats when the server returns 401', async () => {
    fetchMock.mockResolvedValueOnce({ status: 401 } as Response);
    const context = new ContextSrv();
    await jest.advanceTimersByTimeAsync(900000);
    expect(context.isSignedIn).toBe(false);
    expect(context.user.isSignedIn).toBe(false);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not overlap requests or restart after logout during a request', async () => {
    let complete!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (complete = resolve)));
    const context = new ContextSrv();
    await jest.advanceTimersByTimeAsync(900000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    context.setLoggedOut();
    complete({ status: 200 } as Response);
    await jest.advanceTimersByTimeAsync(900000);
    expect(context.isSignedIn).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
