import { type DataSourceApi } from '@grafana/data';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import * as correlationsUtils from 'app/features/correlations/utils';
import { type ExploreItemState } from 'app/types/explore';
import { type StoreState, type ThunkDispatch } from 'app/types/store';

import { configureStore } from '../../../store/configureStore';

import { updateDatasourceInstanceAction, datasourceReducer, changeDatasource } from './datasource';
import * as queryActions from './query';
import { createDefaultInitialState } from './testHelpers';
import * as utils from './utils';
import { createEmptyQueryResponse } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: (ref?: DataSourceRef | string) => {
    const uid = typeof ref === 'string' ? ref : ref?.uid ?? 'mock-uid';
    const type = typeof ref === 'object' ? ref?.type ?? 'prometheus' : 'prometheus';
    return Promise.resolve({
      uid,
      type,
      getRef: () => ({ uid, type }),
    });
  },
}));

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
});

describe('changeDatasource', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should import queries, fall back to empty correlations, and run queries when correlations lookup fails', async () => {
    const targetDS = {
      uid: 'prom-target',
      type: 'prometheus',
      meta: { id: 'prometheus', mixed: false },
      getRef: () => ({ uid: 'prom-target', type: 'prometheus' }),
    } as unknown as DataSourceApi;

    jest.spyOn(utils, 'loadAndInitDatasource').mockResolvedValue({
      history: [],
      instance: targetDS,
    });

    jest.spyOn(correlationsUtils, 'getCorrelationsFromStorage').mockRejectedValue(new Error('Correlations fetch failed'));

    const sourceDS = {
      uid: 'prom-source',
      type: 'prometheus',
      meta: { id: 'prometheus', mixed: false },
      getRef: () => ({ uid: 'prom-source', type: 'prometheus' }),
    } as unknown as DataSourceApi;

    const { defaultInitialState } = createDefaultInitialState();
    const initialQueries = [{ refId: 'A', datasource: sourceDS.getRef(), expr: 'up' }];

    const { dispatch, getState }: { dispatch: ThunkDispatch; getState: () => StoreState } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          left: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: sourceDS,
            queries: initialQueries,
          },
        },
      },
    } as unknown as Partial<StoreState>);

    jest.spyOn(queryActions, 'importQueries');
    jest.spyOn(queryActions, 'runQueries');

    await dispatch(
      changeDatasource({
        exploreId: 'left',
        datasource: targetDS.getRef(),
        options: { importQueries: true },
      })
    );

    // Queries should be imported before correlations lookup
    expect(queryActions.importQueries).toHaveBeenCalledWith('left', initialQueries, sourceDS, targetDS);

    // Correlations should fall back to empty array
    expect(getState().explore.panes.left!.correlations).toEqual([]);

    // runQueries should still be called even though correlations failed
    expect(queryActions.runQueries).toHaveBeenCalledWith({ exploreId: 'left' });
  });

  it('should call importQueries when switching from Mixed to single datasource', async () => {
    const mixedDS = {
      uid: '-- Mixed --',
      type: 'mixed',
      meta: { id: 'mixed', mixed: true },
      getRef: () => ({ uid: '-- Mixed --', type: 'mixed' }),
    } as unknown as DataSourceApi;

    const targetDS = {
      uid: 'prom-target',
      type: 'prometheus',
      meta: { id: 'prometheus', mixed: false },
      getRef: () => ({ uid: 'prom-target', type: 'prometheus' }),
    } as unknown as DataSourceApi;

    jest.spyOn(utils, 'loadAndInitDatasource').mockResolvedValue({
      history: [],
      instance: targetDS,
    });

    jest.spyOn(correlationsUtils, 'getCorrelationsFromStorage').mockResolvedValue({
      correlations: [],
      page: 0,
      limit: 100,
      totalCount: 0,
    });

    const { defaultInitialState } = createDefaultInitialState();
    const initialQueries = [
      { refId: 'A', datasource: { uid: 'prom-target', type: 'prometheus' }, expr: 'up' },
      { refId: 'B', datasource: { uid: 'loki-source', type: 'loki' }, expr: '{job="x"}' },
    ];

    const { dispatch }: { dispatch: ThunkDispatch } = configureStore({
      ...defaultInitialState,
      explore: {
        panes: {
          left: {
            ...defaultInitialState.explore.panes.left,
            datasourceInstance: mixedDS,
            queries: initialQueries,
          },
        },
      },
    } as unknown as Partial<StoreState>);

    jest.spyOn(queryActions, 'importQueries');

    await dispatch(
      changeDatasource({
        exploreId: 'left',
        datasource: targetDS.getRef(),
        options: { importQueries: true },
      })
    );

    expect(queryActions.importQueries).toHaveBeenCalledWith('left', initialQueries, mixedDS, targetDS);
  });
});
