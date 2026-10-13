import { renderHook, waitFor } from '@testing-library/react';

import { type DataSourceJsonData } from '@grafana/data';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';

import { useDataSourcesWithValidRecordingTarget } from './hooks';
import { DataSourceInstanceSettingsFactory, setupDataSources } from './mocks/fakes/DataSources';

jest.mock('@grafana/runtime/unstable', () => {
  const actual = jest.requireActual('@grafana/runtime/unstable');
  return {
    ...actual,
    useDataSourceInstanceList: jest.fn(actual.useDataSourceInstanceList),
  };
});

const runtime = jest.requireActual('@grafana/runtime/unstable');
const hookMock = jest.mocked(useDataSourceInstanceList);

function dataSource(uid: string, type = 'prometheus', jsonData: DataSourceJsonData = {}) {
  return DataSourceInstanceSettingsFactory.build({ uid, name: uid, type, jsonData });
}

afterEach(() => {
  jest.clearAllMocks();
  hookMock.mockImplementation(runtime.useDataSourceInstanceList);
});

describe('useDataSourcesWithValidRecordingTarget', () => {
  it('reports loading with no items, then the valid targets', async () => {
    setupDataSources(dataSource('prom'), dataSource('opted-out', 'prometheus', { allowAsRecordingRulesTarget: false }));

    const { result } = renderHook(() => useDataSourcesWithValidRecordingTarget());

    expect(result.current).toEqual({ items: [], isLoading: true, error: undefined });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((ds) => ds.uid)).toEqual(['prom']);
    expect(result.current.error).toBeUndefined();
  });

  it('exposes the error when discovery fails', async () => {
    hookMock.mockReturnValue({ items: [], isLoading: false, error: new Error('list request failed') });

    const { result } = renderHook(() => useDataSourcesWithValidRecordingTarget());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toEqual(new Error('list request failed'));
  });
});
