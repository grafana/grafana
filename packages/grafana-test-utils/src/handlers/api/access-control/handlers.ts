import { HttpResponse, http } from 'msw';

const searchTeamRolesHandler = () =>
  http.post('/api/access-control/teams/roles/search', async () => {
    // TODO: Add better mock roles response as needed
    return HttpResponse.json([]);
  });

const handlers = [searchTeamRolesHandler()];

export default handlers;
