import { HttpResponse, http, type HttpResponseResolver } from 'msw';

const searchTeamRolesHandler = () =>
  http.post('/api/access-control/teams/roles/search', async () => {
    // TODO: Add better mock roles response as needed
    return HttpResponse.json([]);
  });

const setTeamRolesHandler = () =>
  http.put('/api/access-control/teams/:teamId/roles', () => HttpResponse.json({ message: 'Roles updated' }));

export const customSetTeamRolesHandler = (resolver: HttpResponseResolver) =>
  http.put('/api/access-control/teams/:teamId/roles', resolver);

const handlers = [searchTeamRolesHandler(), setTeamRolesHandler()];

export default handlers;
