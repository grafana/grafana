import { type DataSourceApi } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import * as correlationsUtils from 'app/features/correlations/utils';
import { type ExploreItemState } from 'app/types/explore';
import { type StoreState, type ThunkDispatch } from 'app/types/store';

import { addExtraMiddleware, configureStore } from '../../../store/configureStore';

import { updateDatasourceInstanceAction, datasourceReducer, changeDatasource } from './datasource';
import { createDefaultInitialState } from './testHelpers';
import { createEmptyQueryResponse } from './utils';

jest.mock('app/features/correlations/utils', () =>
  jest
    .requireActual('test/helpers/partialMock')
    .partialMock(jest.requireActual('app/features/correlations/utils'), { getCorrelationsFromStorage: jest.fn() })
);

const recordAction = jest.fn();
addExtraMiddleware(() => (next) => (action) => {
  recordAction(action);
  return next(action);
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  getDataSourceInstance: jest.fn(),
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
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDataSourceInstance).mockReset();
    jest.mocked(correlationsUtils.getCorrelationsFromStorage).mockReset();
  });

  it('should import queries, fall back to empty correlations, and run queries when correlations lookup fails', async () => {
    const targetDS = {
      uid: 'prom-target',
      type: 'prometheus',
      meta: { id: 'prometheus', mixed: false },
      getRef: () => ({ uid: 'prom-target', type: 'prometheus' }),
    } as unknown as DataSourceApi;

    jest.mocked(getDataSourceInstance).mockResolvedValue(targetDS);

    jest.mocked(correlationsUtils.getCorrelationsFromStorage).mockRejectedValue(new Error('Correlations fetch failed'));

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

    await dispatch(
      changeDatasource({
        exploreId: 'left',
        datasource: targetDS.getRef(),
        options: { importQueries: true },
      })
    );

    // Importing preserves the query and moves it to the selected datasource before correlations lookup.
    expect(getDataSourceInstance).toHaveBeenCalledWith(targetDS.getRef());
    expect(getState().explore.panes.left!.datasourceInstance).toBe(targetDS);
    expect(recordAction).toHaveBeenCalledWith({
      type: 'explore/queriesImported',
      payload: {
        exploreId: 'left',
        queries: [expect.objectContaining({ refId: 'A', expr: 'up', datasource: targetDS.getRef() })],
      },
    });
    expect(correlationsUtils.getCorrelationsFromStorage).toHaveBeenCalledWith(
      expect.any(Function),
      [expect.objectContaining({ refId: 'A', expr: 'up', datasource: targetDS.getRef() })],
      targetDS.uid
    );

    // Correlations should fall back to empty array
    expect(getState().explore.panes.left!.correlations).toEqual([]);

    // Queries should still run even though correlations failed.
    expect(recordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'explore/runQueries/pending',
        meta: expect.objectContaining({ arg: { exploreId: 'left' } }),
      })
    );
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

    jest
      .mocked(getDataSourceInstance)
      .mockResolvedValue(targetDS)
      .mockResolvedValueOnce(targetDS)
      .mockResolvedValueOnce(targetDS)
      .mockResolvedValueOnce({
        uid: 'loki-source',
        meta: { id: 'loki' },
        getRef: () => ({ uid: 'loki-source', type: 'loki' }),
      } as DataSourceApi);

    jest.mocked(correlationsUtils.getCorrelationsFromStorage).mockResolvedValue({
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

    await dispatch(
      changeDatasource({
        exploreId: 'left',
        datasource: targetDS.getRef(),
        options: { importQueries: true },
      })
    );

    expect(getDataSourceInstance).toHaveBeenCalledWith(targetDS.getRef());
    expect(recordAction).toHaveBeenCalledWith({
      type: 'explore/queriesImported',
      payload: {
        exploreId: 'left',
        queries: [expect.objectContaining({ refId: 'A', expr: 'up', datasource: targetDS.getRef() })],
      },
    });
    expect(correlationsUtils.getCorrelationsFromStorage).toHaveBeenCalledWith(
      expect.any(Function),
      [expect.objectContaining({ refId: 'A', expr: 'up', datasource: targetDS.getRef() })],
      targetDS.uid
    );
  });
});
