import { reducerTester } from '../../../test/core/redux/reducerTester';
import { initialTeamsState, teamsLoaded } from '../../features/teams/state/reducers';
import { Team } from '../../types';
import { StoreState } from '../../types/store';
import { cleanUpAction } from '../actions/cleanUp';

import { createRootReducer } from './root';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    bootData: {
      navTree: [],
      user: {},
    },
  },
}));

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
        .whenActionIsDispatched(teamsLoaded({ teams: teams, page: 1, noTeams: false, perPage: 30, totalCount: 1 }))
        .thenStatePredicateShouldEqual((resultingState) => {
          expect(resultingState.teams).toEqual({
            hasFetched: true,
            noTeams: false,
            perPage: 30,
            totalPages: 1,
            query: '',
            page: 1,
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
          query: '',
          page: 1,
          noTeams: false,
          totalPages: 1,
          perPage: 30,
          teams,
        },
      } as StoreState;

      reducerTester<StoreState>()
        .givenReducer(rootReducer, state, false, true)
        .whenActionIsDispatched(
          cleanUpAction({ cleanupAction: (storeState) => (storeState.teams = initialTeamsState) })
        )
        .thenStatePredicateShouldEqual((resultingState) => {
          expect(resultingState.teams).toEqual({ ...initialTeamsState });
          return true;
        });
    });
  });
});
