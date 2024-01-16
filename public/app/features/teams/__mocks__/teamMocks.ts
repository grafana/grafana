import { Team, TeamGroup, TeamMember, TeamPermissionLevel } from 'app/types';

export const getMultipleMockTeams = (numberOfTeams: number): Team[] => {
  const teams: Team[] = [];
  for (let i = 1; i <= numberOfTeams; i++) {
    teams.push(getMockTeam(i));
  }

  return teams;
};

export const getMockTeam = (i = 1, overrides = {}): Team => {
  return {
    id: i,
    name: `test-${i}`,
    avatarUrl: 'some/url/',
    email: `test-${i}@test.com`,
    memberCount: i,
    permission: TeamPermissionLevel.Member,
    accessControl: { isEditor: false },
    orgId: 0,
    ...overrides,
  };
};

export const getMockTeamMember = (): TeamMember => {
  return {
    userId: 1,
    teamId: 1,
    avatarUrl: 'some/url/',
    email: 'test@test.com',
    name: 'testName',
    login: 'testUser',
    labels: [],
    permission: TeamPermissionLevel.Member,
  };
};

export const getMockTeamGroups = (amount: number): TeamGroup[] => {
  const groups: TeamGroup[] = [];

  for (let i = 1; i <= amount; i++) {
    groups.push({
      groupId: `group-${i}`,
      teamId: 1,
    });
  }

  return groups;
};
