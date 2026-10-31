import { HttpResponse, http, type HttpResponseResolver } from 'msw';

import { mockTeamsMap } from '../../../../fixtures/teams';
import { getErrorResponse } from '../../../helpers';

const getDisplayMapping = () =>
  http.get<{ namespace: string }>('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/display', ({ request }) => {
    const url = new URL(request.url);
    const keys = url.searchParams.getAll('key');

    // Turn query params such as `user:1` into mock mapping of `User 1` etc.
    const mockMappings = keys.map((key) => {
      const [_, id] = key.split(':');
      const displayName = `User ${id}`;
      return {
        identity: {
          type: 'user',
          name: `u00000000${id}`,
        },
        displayName,
        internalId: parseInt(id, 10),
      };
    });

    return HttpResponse.json({
      metadata: {},
      keys,
      display: mockMappings,
    });
  });

const getTeamHandler = () =>
  http.get<{ namespace: string; uid: string }>(
    '/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/teams/:uid',
    ({ params }) => {
      const { uid } = params;
      const team = mockTeamsMap.get(uid);
      if (!team) {
        return HttpResponse.json(getErrorResponse(`team.iam.grafana.app "${uid}" not found`, 404), { status: 404 });
      }

      return HttpResponse.json(team.team);
    }
  );

const searchTeamsHandler = () =>
  http.get<{ namespace: string }>('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/searchTeams', ({ request }) => {
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('query') || '';

    const items = Array.from(mockTeamsMap.values()).map(({ team }) => team);
    const filteredItems = items
      .filter((item) => item.spec.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .map((team) => ({ name: team.metadata.name, title: team.spec.title }));
    return HttpResponse.json({
      totalHits: filteredItems.length,
      hits: filteredItems,
    });
  });

const listTeamsHandler = () =>
  http.get<{ namespace: string }, never>('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/teams', () => {
    const items = Array.from(mockTeamsMap.values()).map(({ team }) => team);
    return HttpResponse.json({
      metadata: {},
      items,
      kind: 'TeamList',
      apiVersion: 'iam.grafana.app/v0alpha1',
    });
  });

const USER_PERMISSIONS_URL = '/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/users/~/permissions';

// The signed-in user's effective permissions as the AuthZ endpoint serves
// them: a flat list of action/scope pairs. Defaults to wildcard app plugin
// access, matching test setups that grant the flattened plugins.app:access.
const DEFAULT_MOCK_USER_PERMISSIONS = [{ action: 'plugins.app:access', scope: 'plugins:id:*' }];
let mockUserPermissions = DEFAULT_MOCK_USER_PERMISSIONS;

/** Sets the response of the user permissions endpoint (action/scope pairs) for a test */
export const setMockUserPermissions = (permissions: Array<{ action: string; scope: string }>) => {
  mockUserPermissions = permissions;
};

/** Restores the default user permissions response */
export const resetMockUserPermissions = () => {
  mockUserPermissions = DEFAULT_MOCK_USER_PERMISSIONS;
};

/** Override the user permissions endpoint for a test, e.g. to return an error status */
export const customGetUserPermissionsHandler = (resolver: HttpResponseResolver) =>
  http.get(USER_PERMISSIONS_URL, resolver);

const getUserPermissionsHandler = () =>
  customGetUserPermissionsHandler(() => HttpResponse.json({ permissions: mockUserPermissions }));

export default [
  getDisplayMapping(),
  getTeamHandler(),
  listTeamsHandler(),
  searchTeamsHandler(),
  getUserPermissionsHandler(),
];
