// @todo: replace barrel import path
import { Team, TeamState } from 'app/types/index';

export const getTeamGroups = (state: TeamState) => state.groups;

export const getTeam = (state: TeamState, currentTeamId: any): Team | null => {
  if (state.team.id === parseInt(currentTeamId, 10)) {
    return state.team;
  }

  return null;
};
