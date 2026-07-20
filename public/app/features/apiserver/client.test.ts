import { Subject, throwError } from 'rxjs';

import { type LiveChannelEvent, LiveChannelEventType } from '@grafana/data';
import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { DatasourceAPIVersions, ScopedResourceClient } from './client';
import { type GroupVersionResource } from './types';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn().mockReturnValue({
    get: jest.fn(),
    post: jest.fn(),
  }),
  getGrafanaLiveSrv: jest.fn(),
  config: {
    buildInfo: { versionString: 'test-version' },
  },
}));

jest.mock('app/core/services/context_srv');

jest.mock('../../api/utils', () => ({
  getAPINamespace: jest.fn().mockReturnValue('default'),
}));

describe('DatasourceAPIVersions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('get', async () => {
    const getMock = jest.fn().mockResolvedValue({
      groups: [
        { name: 'grafana-testdata-datasource.datasource.grafana.app', preferredVersion: { version: 'v1' } },
        { name: 'prometheus.datasource.grafana.app', preferredVersion: { version: 'v2' } },
        { name: 'myorg-myplugin.datasource.grafana.app', preferredVersion: { version: 'v3' } },
      ],
    });
    getBackendSrv().get = getMock;
    const apiVersions = new DatasourceAPIVersions();
    expect(await apiVersions.get('grafana-testdata-datasource')).toBe('v1');
    expect(await apiVersions.get('prometheus')).toBe('v2');
    expect(await apiVersions.get('graphite')).toBeUndefined();
    expect(await apiVersions.get('myorg-myplugin')).toBe('v3');
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/apis');
  });
});

describe('ScopedResourceClient', () => {
  let client: ScopedResourceClient;
  let postMock: jest.Mock;
  const gvr: GroupVersionResource = { group: 'test.grafana.app', version: 'v1', resource: 'testresources' };

  beforeEach(() => {
    jest.clearAllMocks();
    postMock = jest.fn().mockResolvedValue({ metadata: { name: 'created-resource' } });
    (getBackendSrv as jest.Mock).mockReturnValue({
      post: postMock,
    });
    client = new ScopedResourceClient(gvr);
  });

  describe('create', () => {
    it('should generate name prefix from user login with alphabetic characters', async () => {
      contextSrv.user.login = 'john.doe123';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'jo',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should handle login with special characters and numbers', async () => {
      contextSrv.user.login = 'user@example.com';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'us',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should handle login starting with numbers', async () => {
      contextSrv.user.login = '123admin456';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'ad',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should handle login with only one alphabetic character', async () => {
      contextSrv.user.login = '123a456';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'a',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should handle login with no alphabetic characters', async () => {
      contextSrv.user.login = '12345@#$%';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'g',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should fall back to "g" when no login exists', async () => {
      // @ts-expect-error - we want to test the fallback behavior
      contextSrv.user.login = null;

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'g',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should fall back to "g" when login is undefined', async () => {
      // @ts-expect-error - we want to test the fallback behavior
      contextSrv.user.login = undefined;

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'g',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should fall back to "g" when login is empty string', async () => {
      contextSrv.user.login = '';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'g',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should not set generateName when metadata.name is already provided', async () => {
      contextSrv.user.login = 'testuser';

      const obj = { metadata: { name: 'existing-name' }, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            name: 'existing-name',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
      expect(postMock.mock.calls[0][1].metadata).not.toHaveProperty('generateName');
    });

    it('should not set generateName when metadata.generateName is already provided', async () => {
      contextSrv.user.login = 'testuser';

      const obj = { metadata: { generateName: 'existing-prefix' }, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'existing-prefix',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });
  });
});

describe('ScopedResourceClient watch (polling fallback)', () => {
  const provisioningGvr: GroupVersionResource = {
    group: 'provisioning.grafana.app',
    version: 'v0alpha1',
    resource: 'repositories',
  };

  let client: ScopedResourceClient;
  let getMock: jest.Mock;
  let getStreamMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // The polling fallback logs via console.warn; suppress jest-fail-on-console.
    jest.spyOn(console, 'warn').mockImplementation();

    getMock = jest.fn();
    getStreamMock = jest.fn();

    (getGrafanaLiveSrv as jest.Mock).mockReturnValue({
      getStream: getStreamMock,
    });

    (getBackendSrv as jest.Mock).mockReturnValue({
      get: getMock,
    });

    contextSrv.user.uid = 'test-uid';
    client = new ScopedResourceClient(provisioningGvr);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('forwards events from the Live channel when it works', () => {
    const stream = new Subject<LiveChannelEvent>();
    getStreamMock.mockReturnValue(stream.asObservable());

    const events: Array<{ type: string; object: unknown }> = [];
    const subscription = client.watch().subscribe({
      next: (event) => events.push(event),
    });

    const resourceEvent = { type: 'ADDED', object: { metadata: { name: 'repo-1' }, spec: {} } };
    stream.next({
      type: LiveChannelEventType.Message,
      message: resourceEvent,
    });

    expect(events).toEqual([resourceEvent]);
    subscription.unsubscribe();
  });

  it('falls back to polling when live channel errors', async () => {
    const wsError = new Error('WebSocket failed');
    getStreamMock.mockReturnValue(throwError(() => wsError));

    const itemA = { metadata: { name: 'repo-a', resourceVersion: '1' }, spec: {} };
    getMock.mockResolvedValueOnce({ items: [itemA], metadata: {} });

    const events: Array<{ type: string; object: unknown }> = [];
    client.watch().subscribe({
      next: (event) => events.push(event),
      error: () => {},
    });

    await jest.advanceTimersByTimeAsync(0);

    expect(events).toEqual([{ type: 'ADDED', object: itemA }]);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces original watch error when first poll also fails', async () => {
    const wsError = new Error('WebSocket failed');
    getStreamMock.mockReturnValue(throwError(() => wsError));

    getMock.mockRejectedValueOnce(new Error('HTTP 403'));

    let receivedError: unknown;
    client.watch().subscribe({
      next: () => {},
      error: (err) => {
        receivedError = err;
      },
    });

    await jest.advanceTimersByTimeAsync(0);

    // Original watch error is surfaced, not the poll error
    expect(receivedError).toBe(wsError);
  });

  it('emits correct diff events across polling cycles', async () => {
    getStreamMock.mockReturnValue(throwError(() => new Error('ws')));

    const itemA = { metadata: { name: 'a', resourceVersion: '1' }, spec: {} };
    const itemB = { metadata: { name: 'b', resourceVersion: '1' }, spec: {} };
    const itemAv2 = { metadata: { name: 'a', resourceVersion: '2' }, spec: { updated: true } };
    const itemC = { metadata: { name: 'c', resourceVersion: '1' }, spec: {} };

    // First poll: A, B
    getMock.mockResolvedValueOnce({ items: [itemA, itemB], metadata: {} });
    // Second poll: A (changed RV), C (new) — B removed
    getMock.mockResolvedValueOnce({ items: [itemAv2, itemC], metadata: {} });
    // Third poll: same as second — no changes
    getMock.mockResolvedValueOnce({ items: [itemAv2, itemC], metadata: {} });

    const events: Array<{ type: string; object: unknown }> = [];
    client.watch().subscribe({
      next: (event) => events.push(event),
      error: () => {},
    });

    // First poll
    await jest.advanceTimersByTimeAsync(0);
    expect(events).toEqual([
      { type: 'ADDED', object: itemA },
      { type: 'ADDED', object: itemB },
    ]);

    events.length = 0;

    // Second poll (5s later)
    await jest.advanceTimersByTimeAsync(5000);
    expect(events).toEqual([
      { type: 'MODIFIED', object: itemAv2 },
      { type: 'ADDED', object: itemC },
      { type: 'DELETED', object: itemB },
    ]);

    events.length = 0;

    // Third poll (another 5s) — same data, no events
    await jest.advanceTimersByTimeAsync(5000);
    expect(events).toEqual([]);
  });

  it('tolerates subsequent poll errors without terminating', async () => {
    getStreamMock.mockReturnValue(throwError(() => new Error('ws')));

    const itemA = { metadata: { name: 'a', resourceVersion: '1' }, spec: {} };
    const itemAv2 = { metadata: { name: 'a', resourceVersion: '2' }, spec: {} };

    getMock.mockResolvedValueOnce({ items: [itemA], metadata: {} });
    getMock.mockRejectedValueOnce(new Error('timeout'));
    getMock.mockResolvedValueOnce({ items: [itemAv2], metadata: {} });

    const events: Array<{ type: string; object: unknown }> = [];
    let error: unknown;
    client.watch().subscribe({
      next: (event) => events.push(event),
      error: (err) => {
        error = err;
      },
    });

    // First poll: success
    await jest.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);

    // Second poll: error swallowed
    await jest.advanceTimersByTimeAsync(5000);
    expect(error).toBeUndefined();

    // Third poll: recovery
    await jest.advanceTimersByTimeAsync(5000);
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ type: 'MODIFIED', object: itemAv2 });
  });

  it('errors after max consecutive poll failures', async () => {
    getStreamMock.mockReturnValue(throwError(() => new Error('ws')));

    const itemA = { metadata: { name: 'a', resourceVersion: '1' }, spec: {} };

    // First poll succeeds, then 5 consecutive failures
    getMock.mockResolvedValueOnce({ items: [itemA], metadata: {} });
    for (let i = 0; i < 5; i++) {
      getMock.mockRejectedValueOnce(new Error('server down'));
    }

    let error: unknown;
    client.watch().subscribe({
      next: () => {},
      error: (err) => {
        error = err;
      },
    });

    // First poll: success
    await jest.advanceTimersByTimeAsync(0);
    expect(error).toBeUndefined();

    // Failures 1-4: tolerated
    for (let i = 0; i < 4; i++) {
      await jest.advanceTimersByTimeAsync(5000);
      expect(error).toBeUndefined();
    }

    // Failure 5: circuit breaker trips
    await jest.advanceTimersByTimeAsync(5000);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('server down');
  });

  it('stops polling when unsubscribed', async () => {
    getStreamMock.mockReturnValue(throwError(() => new Error('ws')));

    const itemA = { metadata: { name: 'a', resourceVersion: '1' }, spec: {} };
    getMock.mockResolvedValue({ items: [itemA], metadata: {} });

    const subscription = client.watch().subscribe({ next: () => {} });

    // First poll
    await jest.advanceTimersByTimeAsync(0);
    expect(getMock).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();

    // Should not poll again
    await jest.advanceTimersByTimeAsync(5000);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('passes selectors from watch options to list during polling', async () => {
    getStreamMock.mockReturnValue(throwError(() => new Error('ws')));
    getMock.mockResolvedValueOnce({ items: [], metadata: {} });

    client
      .watch({
        fieldSelector: 'metadata.name=my-job',
        labelSelector: 'app=grafana',
      })
      .subscribe({ next: () => {} });

    await jest.advanceTimersByTimeAsync(0);

    expect(getMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        fieldSelector: 'metadata.name=my-job',
        labelSelector: 'app=grafana',
      })
    );
  });

  it('name option overrides fieldSelector for polling', async () => {
    getStreamMock.mockReturnValue(throwError(() => new Error('ws')));
    getMock.mockResolvedValueOnce({ items: [], metadata: {} });

    client.watch({ name: 'my-repo' }).subscribe({ next: () => {} });

    await jest.advanceTimersByTimeAsync(0);

    expect(getMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        fieldSelector: 'metadata.name=my-repo',
      })
    );
  });
});
