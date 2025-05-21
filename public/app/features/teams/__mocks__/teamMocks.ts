import { randomBytes } from 'crypto';

import { Team, TeamGroup, TeamMember, TeamPermissionLevel } from 'app/types';

function generateShortUid(): string {
  return randomBytes(3).toString('hex'); // Generate a short UID
}

export const getMultipleMockTeams = (numberOfTeams: number): Team[] => {
  const teams: Team[] = [];
  for (let i = 1; i <= numberOfTeams; i++) {
    teams.push(getMockTeam(i));
  }

  return teams;
};

export const getMockTeam = (i = 1, uid = 'aaaaaa', overrides = {}): Team => {
  uid = uid || generateShortUid();
  return {
    id: i,
    uid: uid,
    name: `test-${uid}`,
    avatarUrl: 'some/url/',
    email: `test-${uid}@test.com`,
    memberCount: i,
    accessControl: { isEditor: false },
    orgId: 0,
    isProvisioned: false,
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
