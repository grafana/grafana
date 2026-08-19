import { renderHook } from '@testing-library/react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { useAlertQueriesStatus } from './useAlertQueriesStatus';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  isExpressionReference: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: jest.fn(),
}));

const mockUseDataSourceInstanceList = jest.mocked(useDataSourceInstanceList);
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

function makeListItem(uid: string): DataSourceInstanceListItem {
  return { uid, name: uid } as DataSourceInstanceListItem;
}

function mockList(items: DataSourceInstanceListItem[], overrides: Partial<{ isLoading: boolean; error: Error }> = {}) {
  mockUseDataSourceInstanceList.mockReturnValue({ items, isLoading: false, error: undefined, ...overrides });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsExpressionReference.mockReturnValue(false);
});

describe('useAlertQueriesStatus', () => {
  it('reports a loading state while the datasource list loads', () => {
    mockList([], { isLoading: true });

    const queries = [makeQuery('ds-uid')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.allDataSourcesAvailable).toBe(false);
  });

  it('returns allDataSourcesAvailable=true when all datasources are in the list', () => {
    mockList([makeListItem('ds-uid')]);

    const queries = [makeQuery('ds-uid')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.allDataSourcesAvailable).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('returns allDataSourcesAvailable=false when a datasource is missing from the list', () => {
    mockList([makeListItem('some-other-uid')]);

    const queries = [makeQuery('missing-uid')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    expect(result.current.allDataSourcesAvailable).toBe(false);
  });

  it('skips expression datasources', () => {
    mockIsExpressionReference.mockReturnValue(true);
    mockList([]);

    const queries = [makeQuery('__expr__')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    expect(result.current.allDataSourcesAvailable).toBe(true);
  });

  it('returns allDataSourcesAvailable=false when at least one datasource of many is missing', () => {
    mockList([makeListItem('ds-1')]);

    const queries = [makeQuery('ds-1'), makeQuery('ds-missing')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    expect(result.current.allDataSourcesAvailable).toBe(false);
  });

  it('exposes an error when the datasource list fails to load', () => {
    mockList([], { error: new Error('network failure') });

    const queries = [makeQuery('ds-uid')];
    const { result } = renderHook(() => useAlertQueriesStatus(queries));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.allDataSourcesAvailable).toBe(false);
  });
});
