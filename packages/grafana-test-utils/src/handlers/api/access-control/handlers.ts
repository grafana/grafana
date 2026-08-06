import { HttpResponse, http, type HttpResponseResolver } from 'msw';

const USER_PERMISSIONS_URL = '/api/access-control/user/permissions';

// The signed-in user's permissions as the backend serves them: action →
// scopes. Defaults to wildcard app plugin access, matching test setups that
// grant the flattened plugins.app:access action.
const DEFAULT_MOCK_USER_PERMISSIONS: Record<string, string[]> = { 'plugins.app:access': ['plugins:id:*'] };
let mockUserPermissions = DEFAULT_MOCK_USER_PERMISSIONS;

/** Sets the response of the user permissions endpoint (action → scopes) for a test */
export const setMockUserPermissions = (permissions: Record<string, string[]>) => {
  mockUserPermissions = permissions;
};

/** Override the user permissions endpoint for a test, e.g. to return an error status */
export const customGetUserPermissionsHandler = (resolver: HttpResponseResolver) =>
  http.get(USER_PERMISSIONS_URL, resolver);

const getUserPermissionsHandler = () => customGetUserPermissionsHandler(() => HttpResponse.json(mockUserPermissions));

const searchTeamRolesHandler = () =>
  http.post('/api/access-control/teams/roles/search', async () => {
    // TODO: Add better mock roles response as needed
    return HttpResponse.json([]);
  });

const setTeamRolesHandler = () =>
  http.put('/api/access-control/teams/:teamId/roles', () => HttpResponse.json({ message: 'Roles updated' }));

export const customSetTeamRolesHandler = (resolver: HttpResponseResolver) =>
  http.put('/api/access-control/teams/:teamId/roles', resolver);

const handlers = [getUserPermissionsHandler(), searchTeamRolesHandler(), setTeamRolesHandler()];

export default handlers;
