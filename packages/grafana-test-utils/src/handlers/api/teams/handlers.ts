import { HttpResponse, http } from 'msw';

import { MOCK_TEAMS, mockTeamsMap } from '../../../fixtures/teams';

const k8sTeamToLegacyTeam = (k8sTeam: (typeof MOCK_TEAMS)[number], addAccessControl?: boolean) => {
  return {
    name: k8sTeam.spec.title,
    email: k8sTeam.spec.email,
    id: Number(k8sTeam.metadata.labels['grafana.app/deprecatedInternalID']),
    uid: k8sTeam.metadata.name,
    orgId: 1,
    externalUID: '',
    isProvisioned: false,
    avatarUrl: '',
    memberCount: 0,
    permission: 0,
    accessControl: addAccessControl ? mockAccessControl : null,
  };
};

const mockAccessControl = {
  'teams.permissions:read': true,
  'teams.permissions:write': true,
  'teams:delete': true,
  'teams:read': true,
  'teams:write': true,
};

const getTeamHandler = () =>
  http.get<{ uid: string }>('/api/teams/:uid', async ({ params, request }) => {
    const teamData = mockTeamsMap.get(params.uid);
    const url = new URL(request.url);
    const accessControl = url.searchParams.get('accesscontrol') === 'true';

    if (!teamData) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const response = k8sTeamToLegacyTeam(teamData.team, accessControl);

    return HttpResponse.json(response);
  });

const deleteTeamHandler = () =>
  http.delete<{ uid: string }>('/api/teams/:uid', async ({ params }) => {
    const teamData = mockTeamsMap.get(params.uid);

    if (!teamData) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }

    mockTeamsMap.delete(params.uid);

    return HttpResponse.json({ message: 'Team deleted' });
  });

const teamsPreferencesHandler = () =>
  http.get<{ uid: string }>('/api/teams/:uid/preferences', async ({ params }) => {
    const team = Array.from(mockTeamsMap.values()).find(
      (teamData) => teamData.team.metadata.labels['grafana.app/deprecatedInternalID'] === params.uid
    );

    if (!team) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }

    // TODO: Mock preferences data
    return HttpResponse.json({});
  });

const teamsGroupsHandler = () =>
  http.get<{ uid: string }>('/api/teams/:uid/groups', async ({ params }) => {
    const team = mockTeamsMap.get(params.uid);

    if (!team) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }

    return HttpResponse.json(team.groups);
  });

const teamsUpdateGroupsHandler = () =>
  http.post<{ uid: string }, { groupId: string }>('/api/teams/:uid/groups', async ({ params, request }) => {
    const teamData = mockTeamsMap.get(params.uid);
    const body = await request.json();
    if (!teamData) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const updatedTeam = {
      ...teamData,
      groups: [...teamData.groups, body],
    };
    mockTeamsMap.set(params.uid, updatedTeam);

    return HttpResponse.json({ message: 'Group added to Team' });
  });

const searchTeamsHandler = () =>
  http.get('/api/teams/search', async ({ request }) => {
    const url = new URL(request.url);
    const accessControl = url.searchParams.get('accesscontrol') === 'true';
    // TODO in future: pagination and mock querying
    const page = url.searchParams.get('page') ?? 1;
    const perPage = url.searchParams.get('perPage') ?? 1000;

    return HttpResponse.json({
      totalCount: mockTeamsMap.size,
      teams: Array.from(mockTeamsMap.values()).map((t) => k8sTeamToLegacyTeam(t.team, accessControl)),
      page,
      perPage,
    });
  });

const createTeamHandler = () =>
  http.post<never, { name: string; email: string }>('/api/teams', async ({ request }) => {
    const body = await request.json();

    if (!body.name) {
      return HttpResponse.json({ message: 'bad request data' }, { status: 400 });
    }

    const existingTeam = Array.from(mockTeamsMap.values()).find((teamData) => teamData.team.spec.title === body.name);

    if (existingTeam) {
      return HttpResponse.json({ message: 'Team name taken' }, { status: 409 });
    }
    return HttpResponse.json({ message: 'Team created', teamId: 10, uid: 'aethyfifmhwcgd' }, { status: 200 });
  });

const updateTeamHandler = () =>
  http.put<{ uid: string }, { name: string; email: string }>('/api/teams/:uid', async ({ params, request }) => {
    const teamData = mockTeamsMap.get(params.uid);
    const body = await request.json();
    if (!teamData) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const updatedTeam = {
      ...teamData,
      team: {
        ...teamData.team,
        name: body.name,
        email: body.email,
      },
    };
    mockTeamsMap.set(params.uid, updatedTeam);

    return HttpResponse.json({ message: 'Team updated' });
  });

const handlers = [
  teamsPreferencesHandler(),
  teamsGroupsHandler(),
  teamsUpdateGroupsHandler(),
  searchTeamsHandler(),
  getTeamHandler(),
  deleteTeamHandler(),
  createTeamHandler(),
  updateTeamHandler(),
];

export default handlers;
