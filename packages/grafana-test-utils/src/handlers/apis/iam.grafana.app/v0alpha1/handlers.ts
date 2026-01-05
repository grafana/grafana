import { HttpResponse, http } from 'msw';

import { ExternalGroupMapping } from '@grafana/api-clients/rtkq/iam/v0alpha1';

import { mockTeamsMap } from '../../../../fixtures/teams';

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

const listExternalGroupMappings = () =>
  http.get('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/externalgroupmappings', () => {
    const items = [];
    for (const [teamName, data] of mockTeamsMap.entries()) {
      for (const group of data.groups) {
        items.push({
          apiVersion: 'iam.grafana.app/v0alpha1',
          kind: 'ExternalGroupMapping',
          metadata: {
            name: `mapping-${teamName}-${group.groupId}`,
            creationTimestamp: new Date().toISOString(),
          },
          spec: {
            externalGroupId: group.groupId,
            teamRef: {
              name: teamName,
            },
          },
        });
      }
    }
    return HttpResponse.json({ items });
  });

const createExternalGroupMapping = () =>
  http.post<{ namespace: string }, ExternalGroupMapping>(
    '/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/externalgroupmappings',
    async ({ request }) => {
      const body = await request.json();
      const teamName = body.spec.teamRef.name;
      const groupId = body.spec.externalGroupId;

      const teamData = mockTeamsMap.get(teamName);
      if (teamData) {
        teamData.groups.push({ groupId });
      }

      return HttpResponse.json({
        ...body,
        metadata: {
          name: `mapping-${teamName}-${groupId}`,
          creationTimestamp: new Date().toISOString(),
          ...body.metadata,
        },
      });
    }
  );

const deleteExternalGroupMapping = () =>
  http.delete('/apis/iam.grafana.app/v0alpha1/namespaces/:namespace/externalgroupmappings/:name', ({ params }) => {
    const { name } = params;

    for (const [teamName, data] of mockTeamsMap.entries()) {
      const groupIndex = data.groups.findIndex((g) => `mapping-${teamName}-${g.groupId}` === name);
      if (groupIndex !== -1) {
        data.groups.splice(groupIndex, 1);
        return HttpResponse.json({ status: 'Success' });
      }
    }

    return HttpResponse.json({ status: 'Failure', message: 'Not found' }, { status: 404 });
  });

export default [
  getDisplayMapping(),
  listExternalGroupMappings(),
  createExternalGroupMapping(),
  deleteExternalGroupMapping(),
];
