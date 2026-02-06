import { HttpResponse, http } from 'msw';

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

export default [getDisplayMapping(), getTeamHandler(), listTeamsHandler()];
