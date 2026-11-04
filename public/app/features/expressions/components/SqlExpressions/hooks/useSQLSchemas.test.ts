import { act, renderHook, waitFor } from '@testing-library/react';

import * as runtime from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { isDashboardDatasource, type SQLSchemasResponse, useSQLSchemas } from './useSQLSchemas';

const mockPost = jest.fn();
const mockGetDataSourceInstanceSettings = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ post: mockPost }),
  getDataSourceInstanceSettings: (...args: unknown[]) => mockGetDataSourceInstanceSettings(...args),
}));

describe('useSQLSchemas', () => {
  it('keeps the previous schema visible while a refetch is in flight', async () => {
    const previousQueryService = runtime.config.featureToggles.queryService;
    runtime.config.featureToggles.queryService = true;
    const firstResponse: SQLSchemasResponse = {
      kind: 'SQLSchemaResponse',
      apiVersion: 'query.grafana.app/v0alpha1',
      sqlSchemas: {
        A: {
          columns: [{ name: 'value', mysqlType: 'DOUBLE', dataFrameFieldType: 'float64', nullable: false }],
          sampleRows: [],
        },
      },
    };
    let resolveRefetch!: (response: SQLSchemasResponse) => void;
    mockPost
      .mockResolvedValueOnce(firstResponse)
      .mockReturnValueOnce(new Promise((resolve) => (resolveRefetch = resolve)));
    mockGetDataSourceInstanceSettings.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useSQLSchemas({
        queries: [{ refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } }],
        enabled: true,
      })
    );
    await waitFor(() => expect(result.current.schemas).toEqual(firstResponse));

    let refetchPromise!: Promise<void>;
    act(() => {
      refetchPromise = result.current.refetch();
    });
    expect(result.current.schemas).toEqual(firstResponse);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveRefetch(firstResponse);
      await refetchPromise;
    });

    runtime.config.featureToggles.queryService = previousQueryService;
    mockPost.mockReset();
    mockGetDataSourceInstanceSettings.mockReset();
  });
});

describe('isDashboardDatasource', () => {
  it('identifies Dashboard datasource queries in a mixed set', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { uid: 'prometheus-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'datasource' } },
      { refId: 'C', datasource: { uid: 'mysql-uid', type: 'mysql' } },
    ];

    const nonDashboardQueries = queries.filter((q) => !isDashboardDatasource(q));

    expect(nonDashboardQueries.map((q) => q.refId)).toEqual(['A', 'C']);
  });

  it('returns true when query has dashboard datasource uid', () => {
    const query: DataQuery = {
      refId: 'A',
      datasource: { uid: SHARED_DASHBOARD_QUERY, type: 'datasource' },
    };
    expect(isDashboardDatasource(query)).toBe(true);
  });
});
