import { CoreApp, DataQueryRequest, DataQueryResponse, LoadingState } from '@grafana/data';

import {
  finalizeDashboardRequestTracking,
  initializeDashboardRunningQueryCount,
  startDashboardRequestTracking,
  trackDashboardRequestPacket,
} from './runningQueryCount';

const getCount = () => window.__grafanaRunningQueryCount;

const makeRequest = (overrides: Partial<DataQueryRequest> = {}): DataQueryRequest => {
  return {
    app: CoreApp.Dashboard,
    panelId: 1,
    requestId: 'req-1',
    targets: [{ refId: 'A' }],
    range: { from: 0, to: 0, raw: { from: 'now-1h', to: 'now' } },
    ...overrides,
  } as DataQueryRequest;
};

const makePacket = (overrides: Partial<DataQueryResponse> = {}): DataQueryResponse => {
  return {
    data: [{ refId: 'A' }] as any,
    ...overrides,
  };
};

describe('runningQueryCount', () => {
  beforeEach(() => {
    initializeDashboardRunningQueryCount([]);
  });

  it('sets total panel count and completes non-query panels', () => {
    initializeDashboardRunningQueryCount([
      { id: 1, hasQueries: true },
      { id: 2, hasQueries: false },
      { id: 3, hasQueries: true },
    ]);

    expect(getCount()).toBe(2);
  });

  it('adds expected queries and decrements per completed query and panel', () => {
    initializeDashboardRunningQueryCount([{ id: 1, hasQueries: true }]);

    const request = makeRequest({
      requestId: 'req-queries',
      targets: [{ refId: 'A' }, { refId: 'B' }],
    });

    startDashboardRequestTracking(request);
    expect(getCount()).toBe(3);

    trackDashboardRequestPacket(
      request.requestId!,
      makePacket({ key: 'A', state: LoadingState.Done, data: [{ refId: 'A' }] as any })
    );
    expect(getCount()).toBe(2);

    trackDashboardRequestPacket(
      request.requestId!,
      makePacket({ key: 'B', state: LoadingState.Done, data: [{ refId: 'B' }] as any })
    );
    expect(getCount()).toBe(0);
  });

  it('treats streaming packet as query completion only once', () => {
    initializeDashboardRunningQueryCount([{ id: 1, hasQueries: true }]);

    const request = makeRequest({ requestId: 'req-stream', targets: [{ refId: 'A' }] });
    startDashboardRequestTracking(request);
    expect(getCount()).toBe(2);

    trackDashboardRequestPacket(
      request.requestId!,
      makePacket({ key: 'A', state: LoadingState.Streaming })
    );
    expect(getCount()).toBe(0);

    trackDashboardRequestPacket(
      request.requestId!,
      makePacket({ key: 'A', state: LoadingState.Streaming })
    );
    expect(getCount()).toBe(0);

    finalizeDashboardRequestTracking(request.requestId!);
    expect(getCount()).toBe(0);
  });

  it('accounts for extra query keys beyond expected', () => {
    initializeDashboardRunningQueryCount([{ id: 1, hasQueries: true }]);

    const request = makeRequest({ requestId: 'req-split', targets: [{ refId: 'A' }] });
    startDashboardRequestTracking(request);
    expect(getCount()).toBe(2);

    trackDashboardRequestPacket(
      request.requestId!,
      makePacket({ key: 'A', state: LoadingState.Done, data: [{ refId: 'A' }] as any })
    );
    expect(getCount()).toBe(0);

    trackDashboardRequestPacket(
      request.requestId!,
      makePacket({ key: 'B', state: LoadingState.Loading, data: [{ refId: 'B' }] as any })
    );
    expect(getCount()).toBe(2);

    trackDashboardRequestPacket(
      request.requestId!,
      makePacket({ key: 'B', state: LoadingState.Done, data: [{ refId: 'B' }] as any })
    );
    expect(getCount()).toBe(0);
  });

  it('finalizes remaining queries on completion', () => {
    initializeDashboardRunningQueryCount([{ id: 1, hasQueries: true }]);

    const request = makeRequest({
      requestId: 'req-finalize',
      targets: [{ refId: 'A' }, { refId: 'B' }],
    });

    startDashboardRequestTracking(request);
    expect(getCount()).toBe(3);

    trackDashboardRequestPacket(
      request.requestId!,
      makePacket({ key: 'A', state: LoadingState.Done, data: [{ refId: 'A' }] as any })
    );
    expect(getCount()).toBe(2);

    finalizeDashboardRequestTracking(request.requestId!);
    expect(getCount()).toBe(0);
  });

  it('ignores non-dashboard requests', () => {
    initializeDashboardRunningQueryCount([{ id: 1, hasQueries: true }]);
    const request = makeRequest({ app: CoreApp.Explore, requestId: 'req-ignore' });

    const started = startDashboardRequestTracking(request);
    expect(started).toBe(false);
    expect(getCount()).toBe(1);
  });
});
