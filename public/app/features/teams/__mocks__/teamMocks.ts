import { Team } from '../../../types';

export const getMultipleMockTeams = (numberOfTeams: number): Team[] => {
  let teams: Team[] = [];
  for (let i = 1; i <= numberOfTeams; i++) {
    teams.push({
      id: i,
      name: `test-${i}`,
      avatarUrl: 'some/url/',
      email: `test-${i}@test.com`,
      memberCount: i,
      search: '',
      members: [],
      groups: [],
    });
  }

  return teams;
};

export const getMockTeam = (): Team => {
  return {
    id: 1,
    name: 'test',
    avatarUrl: 'some/url/',
    email: 'test@test.com',
    memberCount: 1,
    search: '',
    members: [],
    groups: [],
  };
};
