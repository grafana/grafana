import { renderHook, waitFor } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { getInstanceSettings, isExpressionReference } from '@grafana/runtime';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { useAlertQueriesStatus } from './useAlertQueriesStatus';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getInstanceSettings: jest.fn(),
  isExpressionReference: jest.fn(),
}));

const mockGetInstanceSettings = jest.mocked(getInstanceSettings);
const mockIsExpressionReference = jest.mocked(isExpressionReference);

function makeQuery(uid: string): AlertQuery {
  return {
    refId: 'A',
    datasourceUid: uid,
    queryType: '',
    model: { refId: 'A' },
    relativeTimeRange: { from: 600, to: 0 },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsExpressionReference.mockReturnValue(false);
});

describe('useAlertQueriesStatus', () => {
  it('starts in a loading state', () => {
    // Never-resolving promise keeps the hook in loading state without leaking state updates into later tests.
    mockGetInstanceSettings.mockReturnValue(new Promise<DataSourceInstanceSettings>(() => {}));

    // Stable reference so useAsync doesn't re-fire on re-renders.
    const queries = [makeQuery('ds-uid')];
    const { result, unmount } = renderHook(() => useAlertQueriesStatus(queries));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.allDataSourcesAvailable).toBe(false);

    unmount();
  });

  it('returns allDataSourcesAvailable=true when all datasources are found', async () => {
    mockGetInstanceSettings.mockResolvedValue({ uid: 'ds-uid', name: 'Test DS' } as DataSourceInstanceSettings);

    const queries = [makeQuery('ds-uid')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allDataSourcesAvailable).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('returns allDataSourcesAvailable=false when a datasource is not found', async () => {
    mockGetInstanceSettings.mockResolvedValue(undefined);

    const queries = [makeQuery('missing-uid')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allDataSourcesAvailable).toBe(false);
  });

  it('skips expression datasources', async () => {
    mockIsExpressionReference.mockReturnValue(true);

    const queries = [makeQuery('__expr__')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allDataSourcesAvailable).toBe(true);
    expect(mockGetInstanceSettings).not.toHaveBeenCalled();
  });

  it('returns allDataSourcesAvailable=false when at least one datasource of many is missing', async () => {
    mockGetInstanceSettings
      .mockResolvedValueOnce({ uid: 'ds-1', name: 'DS 1' } as DataSourceInstanceSettings)
      .mockResolvedValueOnce(undefined);

    const queries = [makeQuery('ds-1'), makeQuery('ds-missing')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allDataSourcesAvailable).toBe(false);
  });

  it('exposes an error when getInstanceSettings rejects', async () => {
    mockGetInstanceSettings.mockRejectedValue(new Error('network failure'));

    const queries = [makeQuery('ds-uid')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.allDataSourcesAvailable).toBe(false);
  });
});
