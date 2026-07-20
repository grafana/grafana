import { lastValueFrom, of } from 'rxjs';

import { type DataQueryRequest, getDefaultTimeRange } from '@grafana/data';

import { config } from '../config';
import { type BackendSrv, type BackendSrvRequest, type FetchResponse } from '../services';

import { publicDashboardQueryHandler } from './publicDashboardQueryHandler';

const fetchMock = jest.fn();
const backendSrv = {
  fetch: (options: BackendSrvRequest) => of(fetchMock(options) as FetchResponse),
} as unknown as BackendSrv;

jest.mock('../services/backendSrv', () => ({
  ...jest.requireActual('../services/backendSrv'),
  getBackendSrv: () => backendSrv,
}));

function makeRequest(overrides: Partial<DataQueryRequest> = {}): DataQueryRequest {
  return {
    targets: [{ refId: 'A' }],
    range: getDefaultTimeRange(),
    requestId: 'req-1',
    intervalMs: 5000,
    maxDataPoints: 100,
    ...overrides,
  } as DataQueryRequest;
}

describe('publicDashboardQueryHandler', () => {
  const originalToken = config.publicDashboardAccessToken;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockReturnValue({ data: { results: {} }, status: 200 });
    config.publicDashboardAccessToken = 'test-token';
  });

  afterEach(() => {
    config.publicDashboardAccessToken = originalToken;
  });

  it('returns an empty response and does not call fetch when panelId is undefined', async () => {
    const response = await lastValueFrom(publicDashboardQueryHandler(makeRequest({ panelId: undefined })));

    expect(response.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty response and does not call fetch when panelId is NaN', async () => {
    const response = await lastValueFrom(publicDashboardQueryHandler(makeRequest({ panelId: NaN })));

    expect(response.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls fetch with the panelId-bearing URL when panelId is valid', async () => {
    await lastValueFrom(publicDashboardQueryHandler(makeRequest({ panelId: 42 })));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].url).toBe('/api/public/dashboards/test-token/panels/42/query');
  });

  it('returns an empty response when targets is empty, irrespective of panelId', async () => {
    const response = await lastValueFrom(publicDashboardQueryHandler(makeRequest({ panelId: 42, targets: [] })));

    expect(response.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
