import { refreshExplore } from './actions';
import { ExploreId, ExploreUrlState, ExploreUpdateState } from 'app/types';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { LogsDedupStrategy } from 'app/core/logs_model';
import {
  initializeExploreAction,
  InitializeExplorePayload,
  changeTimeAction,
  updateUIStateAction,
  setQueriesAction,
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
          .thenDispatchedActionsAreEqual(dispatchedActions => {
            const initializeExplore = dispatchedActions[0] as ActionOf<InitializeExplorePayload>;
            const { type, payload } = initializeExplore;

            expect(type).toEqual(initializeExploreAction.type);
            expect(payload.containerWidth).toEqual(containerWidth);
            expect(payload.eventBridge).toEqual(eventBridge);
            expect(payload.exploreDatasources).toEqual([]);
            expect(payload.queries.length).toBe(1); // Queries have generated keys hard to expect on
            expect(payload.range).toEqual(range);
            expect(payload.ui).toEqual(ui);

            return true;
          });
      });
    });

    describe('and update range is set', () => {
      it('then it should dispatch changeTimeAction', () => {
        const { exploreId, range, initialState } = setup({ range: true });

        thunkTester(initialState)
          .givenThunk(refreshExplore)
          .whenThunkIsDispatched(exploreId)
          .thenDispatchedActionsAreEqual(dispatchedActions => {
            expect(dispatchedActions[0].type).toEqual(changeTimeAction.type);
            expect(dispatchedActions[0].payload).toEqual({ exploreId, range });

            return true;
          });
      });
    });

    describe('and update ui is set', () => {
      it('then it should dispatch updateUIStateAction', () => {
        const { exploreId, initialState, ui } = setup({ ui: true });

        thunkTester(initialState)
          .givenThunk(refreshExplore)
          .whenThunkIsDispatched(exploreId)
          .thenDispatchedActionsAreEqual(dispatchedActions => {
            expect(dispatchedActions[0].type).toEqual(updateUIStateAction.type);
            expect(dispatchedActions[0].payload).toEqual({ ...ui, exploreId });

            return true;
          });
      });
    });

    describe('and update queries is set', () => {
      it('then it should dispatch setQueriesAction', () => {
        const { exploreId, initialState } = setup({ queries: true });

        thunkTester(initialState)
          .givenThunk(refreshExplore)
          .whenThunkIsDispatched(exploreId)
          .thenDispatchedActionsAreEqual(dispatchedActions => {
            expect(dispatchedActions[0].type).toEqual(setQueriesAction.type);
            expect(dispatchedActions[0].payload).toEqual({ exploreId, queries: [] });

            return true;
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
        .thenThereAreNoDispatchedActions();
    });
  });
});
