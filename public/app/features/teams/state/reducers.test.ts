import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TeamsState, TeamState } from '../../../types';
import { getMockTeam, getMockTeamGroups, getMockTeamMember } from '../__mocks__/teamMocks';

import {
  initialTeamsState,
  initialTeamState,
  setSearchMemberQuery,
  teamGroupsLoaded,
  teamLoaded,
  queryChanged,
  teamMembersLoaded,
  teamReducer,
  teamsLoaded,
  teamsReducer,
} from './reducers';

describe('teams reducer', () => {
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

  describe('when loadTeamMembersAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TeamState>()
        .givenReducer(teamReducer, { ...initialTeamState })
        .whenActionIsDispatched(teamMembersLoaded([getMockTeamMember()]))
        .thenStateShouldEqual({
          ...initialTeamState,
          members: [getMockTeamMember()],
        });
    });
  });

  describe('when setSearchMemberQueryAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TeamState>()
        .givenReducer(teamReducer, { ...initialTeamState })
        .whenActionIsDispatched(setSearchMemberQuery('member'))
        .thenStateShouldEqual({
          ...initialTeamState,
          searchMemberQuery: 'member',
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
