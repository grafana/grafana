import { renderHook, waitFor } from 'test/test-utils';

import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { mockDataSource } from '../mocks';

import { useDataSourceInstanceListByUid } from './useDataSourceInstanceListByUid';

describe('useDataSourceInstanceListByUid', () => {
  it('indexes the data source list by uid', async () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'prometheus' }));

    const { result } = renderHook(() => useDataSourceInstanceListByUid());

    await waitFor(() => expect(result.current.get('prom-1')?.name).toBe('prometheus'));
    expect(result.current.get('missing-uid')).toBeUndefined();
  });
});
