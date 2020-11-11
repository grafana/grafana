import {
  loadDatasource,
  loadDatasourcePendingAction,
  loadDatasourceReadyAction,
  updateDatasourceInstanceAction,
  datasourceReducer,
} from './datasource';
import { ExploreId, ExploreItemState } from 'app/types';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { DataQuery, DataSourceApi } from '@grafana/data';
import { createEmptyQueryResponse } from './utils';
import { reducerTester } from '../../../../test/core/redux/reducerTester';

describe('loading datasource', () => {
  describe('when loadDatasource thunk is dispatched', () => {
    describe('and all goes fine', () => {
      it('then it should dispatch correct actions', async () => {
        const exploreId = ExploreId.left;
        const name = 'some-datasource';
        const initialState = { explore: { [exploreId]: { requestedDatasourceName: name } } };
        const mockDatasourceInstance = {
          testDatasource: () => {
            return Promise.resolve({ status: 'success' });
          },
          name,
          init: jest.fn(),
          meta: { id: 'some id' },
        };

        const dispatchedActions = await thunkTester(initialState)
          .givenThunk(loadDatasource)
          .whenThunkIsDispatched(exploreId, mockDatasourceInstance);

        expect(dispatchedActions).toEqual([
          loadDatasourcePendingAction({
            exploreId,
            requestedDatasourceName: mockDatasourceInstance.name,
          }),
          loadDatasourceReadyAction({ exploreId, history: [] }),
        ]);
      });
    });

    describe('and user changes datasource during load', () => {
      it('then it should dispatch correct actions', async () => {
        const exploreId = ExploreId.left;
        const name = 'some-datasource';
        const initialState = { explore: { [exploreId]: { requestedDatasourceName: 'some-other-datasource' } } };
        const mockDatasourceInstance = {
          testDatasource: () => {
            return Promise.resolve({ status: 'success' });
          },
          name,
          init: jest.fn(),
          meta: { id: 'some id' },
        };

        const dispatchedActions = await thunkTester(initialState)
          .givenThunk(loadDatasource)
          .whenThunkIsDispatched(exploreId, mockDatasourceInstance);

        expect(dispatchedActions).toEqual([
          loadDatasourcePendingAction({
            exploreId,
            requestedDatasourceName: mockDatasourceInstance.name,
          }),
        ]);
      });
    });
  });
});

describe('Explore item reducer', () => {
  describe('changing datasource', () => {
    describe('when updateDatasourceInstanceAction is dispatched', () => {
      describe('and datasourceInstance supports graph, logs, table and has a startpage', () => {
        it('then it should set correct state', () => {
          const StartPage = {};
          const datasourceInstance = {
            meta: {
              metrics: true,
              logs: true,
            },
            components: {
              ExploreStartPage: StartPage,
            },
          } as DataSourceApi;
          const queries: DataQuery[] = [];
          const queryKeys: string[] = [];
          const initialState: ExploreItemState = ({
            datasourceInstance: null,
            queries,
            queryKeys,
          } as unknown) as ExploreItemState;
          const expectedState: any = {
            datasourceInstance,
            queries,
            queryKeys,
            graphResult: null,
            logsResult: null,
            tableResult: null,
            latency: 0,
            loading: false,
            queryResponse: createEmptyQueryResponse(),
          };

          reducerTester<ExploreItemState>()
            .givenReducer(datasourceReducer, initialState)
            .whenActionIsDispatched(updateDatasourceInstanceAction({ exploreId: ExploreId.left, datasourceInstance }))
            .thenStateShouldEqual(expectedState);
        });
      });
    });
  });
});
