import { refreshExplore, testDatasource, loadDatasource } from './actions';
import { ExploreId, ExploreUrlState, ExploreUpdateState } from 'app/types';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { LogsDedupStrategy } from 'app/core/logs_model';
import {
  initializeExploreAction,
  InitializeExplorePayload,
  changeTimeAction,
  updateUIStateAction,
  setQueriesAction,
  testDataSourcePendingAction,
  testDataSourceSuccessAction,
  testDataSourceFailureAction,
  loadDatasourcePendingAction,
  loadDatasourceReadyAction,
} from './actionTypes';
import { Emitter } from 'app/core/core';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { makeInitialUpdateState } from './reducers';

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
    getExternal: jest.fn().mockReturnValue([]),
    get: jest.fn().mockReturnValue({
      testDatasource: jest.fn(),
      init: jest.fn(),
    }),
  }),
}));

const setup = (updateOverides?: Partial<ExploreUpdateState>) => {
  const exploreId = ExploreId.left;
  const containerWidth = 1920;
  const eventBridge = {} as Emitter;
  const ui = { dedupStrategy: LogsDedupStrategy.none, showingGraph: false, showingLogs: false, showingTable: false };
  const range = { from: 'now', to: 'now' };
  const urlState: ExploreUrlState = { datasource: 'some-datasource', queries: [], range, ui };
  const updateDefaults = makeInitialUpdateState();
  const update = { ...updateDefaults, ...updateOverides };
  const initialState = {
    explore: {
      [exploreId]: {
        initialized: true,
        urlState,
        containerWidth,
        eventBridge,
        update,
        datasourceInstance: { name: 'some-datasource' },
        queries: [],
        range,
        ui,
      },
    },
  };

  return {
    initialState,
    exploreId,
    range,
    ui,
    containerWidth,
    eventBridge,
  };
};

describe('refreshExplore', () => {
  describe('when explore is initialized', () => {
    describe('and update datasource is set', () => {
      it('then it should dispatch initializeExplore', () => {
        const { exploreId, ui, range, initialState, containerWidth, eventBridge } = setup({ datasource: true });

        thunkTester(initialState)
          .givenThunk(refreshExplore)
          .whenThunkIsDispatched(exploreId)
          .then(instance => {
            instance.thenDispatchedActionsAreEqual(dispatchedActions => {
              const initializeExplore = dispatchedActions[2] as ActionOf<InitializeExplorePayload>;
              const { type, payload } = initializeExplore;

              expect(type).toEqual(initializeExploreAction.type);
              expect(payload.containerWidth).toEqual(containerWidth);
              expect(payload.eventBridge).toEqual(eventBridge);
              expect(payload.queries.length).toBe(1); // Queries have generated keys hard to expect on
              expect(payload.range).toEqual(range);
              expect(payload.ui).toEqual(ui);

              return true;
            });
          });
      });
    });

    describe('and update range is set', () => {
      it('then it should dispatch changeTimeAction', () => {
        const { exploreId, range, initialState } = setup({ range: true });

        thunkTester(initialState)
          .givenThunk(refreshExplore)
          .whenThunkIsDispatched(exploreId)
          .then(instance => {
            instance.thenDispatchedActionsAreEqual(dispatchedActions => {
              expect(dispatchedActions[0].type).toEqual(changeTimeAction.type);
              expect(dispatchedActions[0].payload).toEqual({ exploreId, range });

              return true;
            });
          });
      });
    });

    describe('and update ui is set', () => {
      it('then it should dispatch updateUIStateAction', () => {
        const { exploreId, initialState, ui } = setup({ ui: true });

        thunkTester(initialState)
          .givenThunk(refreshExplore)
          .whenThunkIsDispatched(exploreId)
          .then(instance => {
            instance.thenDispatchedActionsAreEqual(dispatchedActions => {
              expect(dispatchedActions[0].type).toEqual(updateUIStateAction.type);
              expect(dispatchedActions[0].payload).toEqual({ ...ui, exploreId });

              return true;
            });
          });
      });
    });

    describe('and update queries is set', () => {
      it('then it should dispatch setQueriesAction', () => {
        const { exploreId, initialState } = setup({ queries: true });

        thunkTester(initialState)
          .givenThunk(refreshExplore)
          .whenThunkIsDispatched(exploreId)
          .then(instance => {
            instance.thenDispatchedActionsAreEqual(dispatchedActions => {
              expect(dispatchedActions[0].type).toEqual(setQueriesAction.type);
              expect(dispatchedActions[0].payload).toEqual({ exploreId, queries: [] });

              return true;
            });
          });
      });
    });
  });

  describe('when update is not initialized', () => {
    it('then it should not dispatch any actions', () => {
      const exploreId = ExploreId.left;
      const initialState = { explore: { [exploreId]: { initialized: false } } };

      thunkTester(initialState)
        .givenThunk(refreshExplore)
        .whenThunkIsDispatched(exploreId)
        .then(instance => instance.thenThereAreNoDispatchedActions());
    });
  });
});

describe('test datasource', () => {
  describe('when testDatasource thunk is dispatched', () => {
    describe('and testDatasource call on instance is successful', () => {
      it('then it should dispatch testDataSourceSuccessAction', () => {
        const exploreId = ExploreId.left;
        const mockDatasourceInstance = {
          testDatasource: () => {
            return Promise.resolve({ status: 'success' });
          },
        };

        thunkTester({})
          .givenThunk(testDatasource)
          .whenThunkIsDispatched(exploreId, mockDatasourceInstance)
          .then(instance => {
            instance.thenDispatchedActionsEqual([
              testDataSourcePendingAction({ exploreId }),
              testDataSourceSuccessAction({ exploreId }),
            ]);
          });
      });
    });

    describe('and testDatasource call on instance is not successful', () => {
      it('then it should dispatch testDataSourceFailureAction', () => {
        const exploreId = ExploreId.left;
        const error = 'something went wrong';
        const mockDatasourceInstance = {
          testDatasource: () => {
            return Promise.resolve({ status: 'fail', message: error });
          },
        };

        thunkTester({})
          .givenThunk(testDatasource)
          .whenThunkIsDispatched(exploreId, mockDatasourceInstance)
          .then(instance => {
            instance.thenDispatchedActionsEqual([
              testDataSourcePendingAction({ exploreId }),
              testDataSourceFailureAction({ exploreId, error }),
            ]);
          });
      });
    });

    describe('and testDatasource call on instance throws', () => {
      it('then it should dispatch testDataSourceFailureAction', () => {
        const exploreId = ExploreId.left;
        const error = 'something went wrong';
        const mockDatasourceInstance = {
          testDatasource: () => {
            throw { statusText: error };
          },
        };

        thunkTester({})
          .givenThunk(testDatasource)
          .whenThunkIsDispatched(exploreId, mockDatasourceInstance)
          .then(instance => {
            instance.thenDispatchedActionsEqual([
              testDataSourcePendingAction({ exploreId }),
              testDataSourceFailureAction({ exploreId, error }),
            ]);
          });
      });
    });
  });
});

describe('loading datasource', () => {
  describe('when loadDatasource thunk is dispatched', () => {
    describe('and all goes fine', () => {
      it('then it should dispatch correct actions', () => {
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

        thunkTester(initialState)
          .givenThunk(loadDatasource)
          .whenThunkIsDispatched(exploreId, mockDatasourceInstance)
          .then(instance => {
            instance.thenDispatchedActionsEqual([
              loadDatasourcePendingAction({
                exploreId,
                requestedDatasourceName: mockDatasourceInstance.name,
              }),
              testDataSourcePendingAction({ exploreId }),
              loadDatasourceReadyAction({ exploreId, history: [] }),
              testDataSourceSuccessAction({ exploreId }),
            ]);
          });
      });
    });

    describe('and user changes datasource during load', () => {
      it('then it should dispatch correct actions', () => {
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

        thunkTester(initialState)
          .givenThunk(loadDatasource)
          .whenThunkIsDispatched(exploreId, mockDatasourceInstance)
          .then(instance => {
            instance.thenDispatchedActionsEqual([
              loadDatasourcePendingAction({
                exploreId,
                requestedDatasourceName: mockDatasourceInstance.name,
              }),
              testDataSourcePendingAction({ exploreId }),
              testDataSourceSuccessAction({ exploreId }),
            ]);
          });
      });
    });
  });
});
