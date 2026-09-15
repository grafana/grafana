import { renderHook, waitFor } from 'test/test-utils';

import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { mockDataSource } from '../mocks';

import { useDataSourceInstanceListByUid } from './useDataSourceInstanceListByUid';

describe('useDataSourceInstanceListByUid', () => {
  it('indexes the data source list by uid', async () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'prometheus' }));

    const { result } = renderHook(() => useDataSourceInstanceListByUid());

    await waitFor(() => expect(result.current.byUid.get('prom-1')?.name).toBe('prometheus'));
    expect(result.current.byUid.get('missing-uid')).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('reports a loading state before the data source list resolves', async () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'prometheus' }));

    const { result } = renderHook(() => useDataSourceInstanceListByUid());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.byUid.size).toBe(0);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
