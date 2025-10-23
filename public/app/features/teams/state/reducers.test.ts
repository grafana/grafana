import { TeamsState, TeamState } from 'app/types/teams';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getMockTeam, getMockTeamGroups } from '../mocks/teamMocks';

import {
  initialTeamsState,
  initialTeamState,
  teamGroupsLoaded,
  teamLoaded,
  queryChanged,
  teamReducer,
  teamsLoaded,
  teamsReducer,
} from './reducers';

xdescribe('teams reducer', () => {
  describe('when teamsLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TeamsState>()
        .givenReducer(teamsReducer, { ...initialTeamsState })
        .whenActionIsDispatched(
          teamsLoaded({ teams: [getMockTeam()], page: 1, perPage: 30, noTeams: false, totalCount: 100 })
        )
        .thenStateShouldEqual({
          ...initialTeamsState,
          hasFetched: true,
          teams: [getMockTeam()],
          noTeams: false,
          totalPages: 4,
          perPage: 30,
          page: 1,
        });
    });
  });

  describe('when setSearchQueryAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TeamsState>()
        .givenReducer(teamsReducer, { ...initialTeamsState })
        .whenActionIsDispatched(queryChanged('test'))
        .thenStateShouldEqual({
          ...initialTeamsState,
          query: 'test',
        });
    });
  });
});

describe('team reducer', () => {
  describe('when loadTeamsAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TeamState>()
        .givenReducer(teamReducer, { ...initialTeamState })
        .whenActionIsDispatched(teamLoaded(getMockTeam()))
        .thenStateShouldEqual({
          ...initialTeamState,
          team: getMockTeam(),
        });
    });
  });

  describe('when loadTeamGroupsAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TeamState>()
        .givenReducer(teamReducer, { ...initialTeamState })
        .whenActionIsDispatched(teamGroupsLoaded(getMockTeamGroups(1)))
        .thenStateShouldEqual({
          ...initialTeamState,
          groups: getMockTeamGroups(1),
        });
    });
  });
});
