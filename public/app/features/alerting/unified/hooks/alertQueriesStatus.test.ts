import { renderHook } from '@testing-library/react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { type AlertQueryDataSources, getAlertQueriesStatus, useAlertQueryDataSources } from './alertQueriesStatus';

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

function makeDataSources(uids: string[]): AlertQueryDataSources {
  return new Map(uids.map((uid) => [uid, makeListItem(uid)]));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsExpressionReference.mockReturnValue(false);
});

describe('useAlertQueryDataSources', () => {
  it('reports a loading state while the datasource list loads', () => {
    mockList([], { isLoading: true });

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-uid')]));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.dataSourcesByUid.size).toBe(0);
  });

  it('exposes an error when the datasource list fails to load', () => {
    mockList([], { error: new Error('network failure') });

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-uid')]));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.dataSourcesByUid.size).toBe(0);
  });

  it('resolves the datasources referenced by the queries, keyed by uid', () => {
    mockList([makeListItem('ds-1'), makeListItem('ds-2')]);

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-1'), makeQuery('ds-2')]));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect([...result.current.dataSourcesByUid.keys()]).toEqual(['ds-1', 'ds-2']);
    expect(result.current.dataSourcesByUid.get('ds-1')).toEqual({ uid: 'ds-1', name: 'ds-1' });
  });

  it('leaves out datasources the queries do not reference', () => {
    mockList([makeListItem('ds-1'), makeListItem('unreferenced')]);

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-1')]));

    expect([...result.current.dataSourcesByUid.keys()]).toEqual(['ds-1']);
  });

  it('omits uids that are missing from the list', () => {
    mockList([makeListItem('ds-1')]);

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-1'), makeQuery('ds-missing')]));

    expect(result.current.dataSourcesByUid.has('ds-missing')).toBe(false);
  });

  it('skips expression references', () => {
    mockIsExpressionReference.mockReturnValue(true);
    mockList([makeListItem('__expr__')]);

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('__expr__')]));

    expect(result.current.dataSourcesByUid.size).toBe(0);
  });

  it('keeps the same map across a rerender with a new but equivalent queries array', () => {
    mockList([makeListItem('ds-1')]);

    // PreviewRule passes a fresh array on every render (react-hook-form's watch), so the map
    // must not be rebuilt unless the referenced uids actually change.
    const { result, rerender } = renderHook(
      ({ queries }: { queries: AlertQuery[] }) => useAlertQueryDataSources(queries),
      {
        initialProps: { queries: [makeQuery('ds-1')] },
      }
    );

    const first = result.current.dataSourcesByUid;
    rerender({ queries: [makeQuery('ds-1')] });

    expect(result.current.dataSourcesByUid).toBe(first);
  });
});

describe('getAlertQueriesStatus', () => {
  it('reports all datasources available when every referenced uid resolved', () => {
    const queries = [makeQuery('ds-1'), makeQuery('ds-2')];

    expect(getAlertQueriesStatus(queries, makeDataSources(['ds-1', 'ds-2']))).toEqual({
      allDataSourcesAvailable: true,
    });
  });

  it('reports a missing datasource when one referenced uid did not resolve', () => {
    const queries = [makeQuery('ds-1'), makeQuery('ds-missing')];

    expect(getAlertQueriesStatus(queries, makeDataSources(['ds-1']))).toEqual({
      allDataSourcesAvailable: false,
    });
  });

  it('reports all datasources available for an expression-only rule', () => {
    mockIsExpressionReference.mockReturnValue(true);

    expect(getAlertQueriesStatus([makeQuery('__expr__')], new Map())).toEqual({
      allDataSourcesAvailable: true,
    });
  });
});
