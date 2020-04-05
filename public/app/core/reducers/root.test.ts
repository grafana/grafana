import { createRootReducer, recursiveCleanState } from './root';
import { describe, expect } from '../../../test/lib/common';
import { NavModelItem } from '@grafana/data';
import { reducerTester } from '../../../test/core/redux/reducerTester';
import { StoreState } from '../../types/store';
import { Team } from '../../types';
import { cleanUpAction } from '../actions/cleanUp';
import { initialTeamsState, teamsLoaded } from '../../features/teams/state/reducers';

jest.mock('@grafana/runtime', () => ({
  config: {
    bootData: {
      navTree: [] as NavModelItem[],
      user: {},
    },
  },
  DataSourceWithBackend: jest.fn(),
}));

describe('recursiveCleanState', () => {
  describe('when called with an existing state selector', () => {
    it('then it should clear that state slice in state', () => {
      const state = {
        teams: { teams: [{ id: 1 }, { id: 2 }] },
      };
      // Choosing a deeper state selector here just to test recursive behaviour
      // This should be same state slice that matches the state slice of a reducer like state.teams
      const stateSelector = state.teams.teams[0];

      recursiveCleanState(state, stateSelector);

      expect(state.teams.teams[0]).not.toBeDefined();
      expect(state.teams.teams[1]).toBeDefined();
    });
  });

  describe('when called with a non existing state selector', () => {
    it('then it should not clear that state slice in state', () => {
      const state = {
        teams: { teams: [{ id: 1 }, { id: 2 }] },
      };
      // Choosing a deeper state selector here just to test recursive behaviour
      // This should be same state slice that matches the state slice of a reducer like state.teams
      const stateSelector = state.teams.teams[2];

      recursiveCleanState(state, stateSelector);

      expect(state.teams.teams[0]).toBeDefined();
      expect(state.teams.teams[1]).toBeDefined();
    });
  });
});

describe('rootReducer', () => {
  const rootReducer = createRootReducer();

  describe('when called with any action except cleanUpAction', () => {
    it('then it should not clean state', () => {
      const teams = [{ id: 1 } as Team];
      const state = {
        teams: { ...initialTeamsState },
      } as StoreState;

      reducerTester<StoreState>()
        .givenReducer(rootReducer, state)
        .whenActionIsDispatched(teamsLoaded(teams))
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.teams).toEqual({
            hasFetched: true,
            searchQuery: '',
            teams,
          });
          return true;
        });
    });
  });

  describe('when called with cleanUpAction', () => {
    it('then it should clean state', () => {
      const teams = [{ id: 1 }] as Team[];
      const state: StoreState = {
        teams: {
          hasFetched: true,
          searchQuery: '',
          teams,
        },
      } as StoreState;

      reducerTester<StoreState>()
        .givenReducer(rootReducer, state, false, true)
        .whenActionIsDispatched(cleanUpAction({ stateSelector: (storeState: StoreState) => storeState.teams }))
        .thenStatePredicateShouldEqual(resultingState => {
          expect(resultingState.teams).toEqual({ ...initialTeamsState });
          return true;
        });
    });
  });
});
