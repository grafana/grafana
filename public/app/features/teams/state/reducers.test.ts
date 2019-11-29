import {
  initialTeamsState,
  initialTeamState,
  loadTeamAction,
  loadTeamMembersAction,
  loadTeamsAction,
  setSearchMemberQueryAction,
  setSearchQueryAction,
  teamSlice,
  teamsSlice,
} from './reducers';
import { getMockTeam, getMockTeamMember } from '../__mocks__/teamMocks';

describe('teams reducer', () => {
  it('should set teams', () => {
    const payload = [getMockTeam()];

    const result = teamsSlice.reducer(initialTeamsState, loadTeamsAction(payload));

    expect(result.teams).toEqual(payload);
  });

  it('should set search query', () => {
    const payload = 'test';

    const result = teamsSlice.reducer(initialTeamsState, setSearchQueryAction(payload));

    expect(result.searchQuery).toEqual('test');
  });
});

describe('team reducer', () => {
  it('should set team', () => {
    const payload = getMockTeam();

    const result = teamSlice.reducer(initialTeamState, loadTeamAction(payload));

    expect(result.team).toEqual(payload);
  });

  it('should set team members', () => {
    const mockTeamMember = getMockTeamMember();

    const result = teamSlice.reducer(initialTeamState, loadTeamMembersAction([mockTeamMember]));

    expect(result.members).toEqual([mockTeamMember]);
  });

  it('should set member search query', () => {
    const payload = 'member';

    const result = teamSlice.reducer(initialTeamState, setSearchMemberQueryAction(payload));

    expect(result.searchMemberQuery).toEqual('member');
  });
});
