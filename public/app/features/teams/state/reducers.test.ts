import {
  initialTeamsState,
  initialTeamState,
  setSearchMemberQuery,
  setSearchQuery,
  teamGroupsLoaded,
  teamLoaded,
  teamMembersLoaded,
  teamReducer,
  teamsLoaded,
  teamsReducer,
} from './reducers';
import { getMockTeam, getMockTeamGroups, getMockTeamMember } from '../__mocks__/teamMocks';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TeamsState, TeamState } from '../../../types';

describe('teams reducer', () => {
  describe('when teamsLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TeamsState>()
        .givenReducer(teamsReducer, { ...initialTeamsState })
        .whenActionIsDispatched(teamsLoaded([getMockTeam()]))
        .thenStateShouldEqual({
          ...initialTeamsState,
          hasFetched: true,
          teams: [getMockTeam()],
        });
    });
  });

  describe('when setSearchQueryAction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TeamsState>()
        .givenReducer(teamsReducer, { ...initialTeamsState })
        .whenActionIsDispatched(setSearchQuery('test'))
        .thenStateShouldEqual({
          ...initialTeamsState,
          searchQuery: 'test',
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
