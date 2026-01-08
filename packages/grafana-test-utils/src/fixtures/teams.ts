import { Chance } from 'chance';

const chance = new Chance('mock-teams');

export const MOCK_TEAMS = [
  {
    metadata: {
      name: chance.string({ length: 14, pool: 'abcdefghijklmnopqrstuvwxyz1234567890' }),
      namespace: 'default',
      resourceVersion: '1737038862000',
      creationTimestamp: '2025-01-16T14:47:42Z',
      labels: {
        'grafana.app/deprecatedInternalID': chance.integer({ min: 1, max: 1000 }).toString(),
      },
      annotations: {
        'grafana.app/updatedTimestamp': '2025-01-16T14:47:42Z',
      },
    },
    spec: {
      title: 'Test Team',
      email: 'foo@example.com',
    },
    status: {},
  },
];

export const MOCK_TEAM_GROUPS = [{ groupId: 'cn=users,ou=groups,dc=grafana,dc=org' }, { groupId: 'another-group' }];

export const setupMockTeams = () => {
  mockTeamsMap.clear();
  MOCK_TEAMS.forEach((team) => {
    mockTeamsMap.set(team.metadata.name, { team, groups: [...MOCK_TEAM_GROUPS] });
  });
};

export const mockTeamsMap = new Map<string, { team: (typeof MOCK_TEAMS)[number]; groups: Array<{ groupId: string }> }>(
  MOCK_TEAMS.map((team) => [team.metadata.name, { team, groups: [...MOCK_TEAM_GROUPS] }])
);
