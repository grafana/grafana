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
  it('returns true when all datasources are available', async () => {
    mockGetInstanceSettings.mockResolvedValue({ uid: 'ds-uid', name: 'Test DS' } as DataSourceInstanceSettings);

    const { result } = renderHook(() => useAlertQueriesStatus([makeQuery('ds-uid')]));

    await waitFor(() => expect(mockGetInstanceSettings).toHaveBeenCalledWith('ds-uid'));
    expect(result.current.allDataSourcesAvailable).toBe(true);
  });

  it('returns false when a datasource is not found', async () => {
    mockGetInstanceSettings.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAlertQueriesStatus([makeQuery('missing-uid')]));

    await waitFor(() => expect(result.current.allDataSourcesAvailable).toBe(false));
  });

  it('skips expression datasources', async () => {
    mockIsExpressionReference.mockReturnValue(true);

    const { result } = renderHook(() => useAlertQueriesStatus([makeQuery('__expr__')]));

    await waitFor(() => expect(result.current.allDataSourcesAvailable).toBe(true));
    expect(mockGetInstanceSettings).not.toHaveBeenCalled();
  });

  it('returns false when at least one datasource of many is missing', async () => {
    mockGetInstanceSettings
      .mockResolvedValueOnce({ uid: 'ds-1', name: 'DS 1' } as DataSourceInstanceSettings)
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAlertQueriesStatus([makeQuery('ds-1'), makeQuery('ds-missing')]));

    await waitFor(() => expect(result.current.allDataSourcesAvailable).toBe(false));
  });
});
