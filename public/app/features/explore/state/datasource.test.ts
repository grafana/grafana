import { type DataSourceApi } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { type ExploreItemState } from 'app/types/explore';

import { updateDatasourceInstanceAction, datasourceReducer } from './datasource';
import { createEmptyQueryResponse } from './utils';

describe('Datasource reducer', () => {
  it('should handle set updateDatasourceInstanceAction correctly', () => {
    const StartPage = {};
    const datasourceInstance = {
      meta: {
        metrics: true,
        logs: true,
      },
      components: {
        QueryEditorHelp: StartPage,
      },
    } as DataSourceApi;
    const queries: DataQuery[] = [];
    const queryKeys: string[] = [];
    const initialState: ExploreItemState = {
      datasourceInstance: null,
      queries,
      queryKeys,
    } as unknown as ExploreItemState;

    const result = datasourceReducer(
      initialState,
      updateDatasourceInstanceAction({ exploreId: 'left', datasourceInstance, history: [] })
    );

    const expectedState: Partial<ExploreItemState> = {
      datasourceInstance,
      queries,
      queryKeys,
      graphResult: null,
      logsResult: null,
      tableResult: null,
      queryResponse: {
        // When creating an empty query response we also create a timeRange object with the current time.
        // Copying the range from the reducer here prevents intermittent failures when creating them at different times.
        ...createEmptyQueryResponse(),
        timeRange: result.queryResponse.timeRange,
      },
    };

    expect(result).toMatchObject(expectedState);
  });

  it('should update queries datasource uid when switching from datasource A to datasource B', () => {
    const datasourceInstanceA = {
      uid: 'prom-a',
      type: 'prometheus',
      meta: {
        id: 'prometheus',
        mixed: false,
      },
      getRef: () => ({ uid: 'prom-a', type: 'prometheus' }),
    } as unknown as DataSourceApi;

    const datasourceInstanceB = {
      uid: 'prom-b',
      type: 'prometheus',
      meta: {
        id: 'prometheus',
        mixed: false,
      },
      getRef: () => ({ uid: 'prom-b', type: 'prometheus' }),
    } as unknown as DataSourceApi;

    const initialQueries: DataQuery[] = [
      { refId: 'A', datasource: { uid: 'prom-a', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'prom-a', type: 'prometheus' } },
    ];

    const initialState: ExploreItemState = {
      datasourceInstance: datasourceInstanceA,
      queries: initialQueries,
      queryKeys: [],
    } as unknown as ExploreItemState;

    const result = datasourceReducer(
      initialState,
      updateDatasourceInstanceAction({ exploreId: 'left', datasourceInstance: datasourceInstanceB, history: [] })
    );

    expect(result.datasourceInstance).toBe(datasourceInstanceB);
    expect(result.queries).toEqual([
      { refId: 'A', datasource: { uid: 'prom-b', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'prom-b', type: 'prometheus' } },
    ]);
  });

  it('should not overwrite queries datasource when switching to a mixed datasource', () => {
    const datasourceInstanceA = {
      uid: 'prom-a',
      type: 'prometheus',
      meta: {
        id: 'prometheus',
        mixed: false,
      },
      getRef: () => ({ uid: 'prom-a', type: 'prometheus' }),
    } as unknown as DataSourceApi;

    const mixedDatasourceInstance = {
      uid: '-- Mixed --',
      type: 'mixed',
      meta: {
        id: 'mixed',
        mixed: true,
      },
      getRef: () => ({ uid: '-- Mixed --', type: 'mixed' }),
    } as unknown as DataSourceApi;

    const initialQueries: DataQuery[] = [
      { refId: 'A', datasource: { uid: 'prom-a', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'loki-a', type: 'loki' } },
    ];

    const initialState: ExploreItemState = {
      datasourceInstance: datasourceInstanceA,
      queries: initialQueries,
      queryKeys: [],
    } as unknown as ExploreItemState;

    const result = datasourceReducer(
      initialState,
      updateDatasourceInstanceAction({ exploreId: 'left', datasourceInstance: mixedDatasourceInstance, history: [] })
    );

    expect(result.datasourceInstance).toBe(mixedDatasourceInstance);
    expect(result.queries).toEqual(initialQueries);
  });
});
