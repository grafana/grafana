import { HttpResponse, http } from 'msw';

import { MOCK_TEAMS } from '../../../fixtures/teams';

const k8sTeamToLegacyTeam = (k8sTeam: (typeof MOCK_TEAMS)[number]) => {
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
  };
};

const searchTeamsHandler = () =>
  http.get('/api/teams/search', async ({ request }) => {
    const url = new URL(request.url);
    // TODO in future: pagination and mock querying
    const page = url.searchParams.get('page') ?? 1;
    const perPage = url.searchParams.get('perPage') ?? 1000;

    return HttpResponse.json({
      totalCount: MOCK_TEAMS.length,
      teams: MOCK_TEAMS.map(k8sTeamToLegacyTeam),
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

    const existingTeam = MOCK_TEAMS.find((t) => t.spec.title === body.name);

    if (existingTeam) {
      return HttpResponse.json({ message: 'Team name taken' }, { status: 409 });
    }
    return HttpResponse.json({ message: 'Team created', teamId: 10, uid: 'aethyfifmhwcgd' }, { status: 200 });
  });

const handlers = [searchTeamsHandler(), createTeamHandler()];

export default handlers;
