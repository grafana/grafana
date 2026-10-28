import { renderHook, waitFor } from '@testing-library/react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { mockDataSource } from '../mocks';

import { type AlertQueryDataSources, getAlertQueriesStatus, useAlertQueryDataSources } from './alertQueriesStatus';

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

function makeDataSources(uids: string[]): AlertQueryDataSources {
  return new Map(uids.map((uid) => [uid, makeListItem(uid)]));
}

function setDataSources(...uids: string[]) {
  const dataSources = uids.map((uid) => mockDataSource({ uid, name: uid }));
  const settings = Object.fromEntries(dataSources.map((dataSource) => [dataSource.name, dataSource]));
  setDataSourceInstanceSettings(settings);
}

afterEach(() => {
  setDataSourceInstanceSettings({});
});

describe('useAlertQueryDataSources', () => {
  it('reports a loading state while the datasource list loads', async () => {
    setDataSources('ds-uid');

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-uid')]));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.dataSourcesByUid.size).toBe(0);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('resolves the datasources referenced by the queries, keyed by uid', async () => {
    setDataSources('ds-1', 'ds-2');

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-1'), makeQuery('ds-2')]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect([...result.current.dataSourcesByUid.keys()]).toEqual(['ds-1', 'ds-2']);
    expect(result.current.dataSourcesByUid.get('ds-1')).toMatchObject({ uid: 'ds-1', name: 'ds-1' });
  });

  it('leaves out datasources the queries do not reference', async () => {
    setDataSources('ds-1', 'unreferenced');

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-1')]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect([...result.current.dataSourcesByUid.keys()]).toEqual(['ds-1']);
  });

  it('omits uids that are missing from the list', async () => {
    setDataSources('ds-1');

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('ds-1'), makeQuery('ds-missing')]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.dataSourcesByUid.has('ds-missing')).toBe(false);
  });

  it('skips expression references', async () => {
    setDataSources('ds-1');

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('__expr__')]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.dataSourcesByUid.size).toBe(0);
  });

  it('rebuilds the map when a uid containing the key separator is swapped for two uids', async () => {
    // A uid can contain any character, so serializing the referenced uids has to distinguish
    // ['a,b'] from ['a', 'b'] — joining on a comma would give both the same memo key.
    setDataSources('a', 'b', 'a,b');

    const { result, rerender } = renderHook(
      ({ queries }: { queries: AlertQuery[] }) => useAlertQueryDataSources(queries),
      { initialProps: { queries: [makeQuery('a,b')] } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect([...result.current.dataSourcesByUid.keys()]).toEqual(['a,b']);

    rerender({ queries: [makeQuery('a'), makeQuery('b')] });

    expect([...result.current.dataSourcesByUid.keys()]).toEqual(['a', 'b']);
  });

  it('reports no loading state when the queries reference no data sources', async () => {
    setDataSources('ds-uid');

    const { result } = renderHook(() => useAlertQueryDataSources([makeQuery('__expr__')]));

    const initialDataSources = result.current.dataSourcesByUid;
    expect(result.current.isLoading).toBe(false);

    await waitFor(() => expect(result.current.dataSourcesByUid).not.toBe(initialDataSources));
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps the same map across a rerender with a new but equivalent queries array', async () => {
    setDataSources('ds-1');

    // PreviewRule passes a fresh array on every render (react-hook-form's watch), so the map
    // must not be rebuilt unless the referenced uids actually change.
    const { result, rerender } = renderHook(
      ({ queries }: { queries: AlertQuery[] }) => useAlertQueryDataSources(queries),
      {
        initialProps: { queries: [makeQuery('ds-1')] },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
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
    expect(getAlertQueriesStatus([makeQuery('__expr__')], new Map())).toEqual({
      allDataSourcesAvailable: true,
    });
  });
});
