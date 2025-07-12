import { Team, TeamState } from 'app/types/teams';

export const getTeamGroups = (state: TeamState) => state.groups;

export const getTeam = (state: TeamState, currentTeamUid: string): Team | null => {
  if (state.team.uid === currentTeamUid) {
    return state.team;
  }

  return null;
};
