import { DefaultBodyType, HttpResponse, HttpResponseResolver, PathParams } from 'msw';

import { PromRuleGroupDTO, PromRulesResponse } from 'app/types/unified-alerting-dto';

/** Helper method to help generate a kubernetes-style response with a list of items */
export const getK8sResponse = <T>(kind: string, items: T[]) => {
  return {
    kind,
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    metadata: {},
    items,
  };
};

/** Expected base URL for our k8s APIs */
export const ALERTING_API_SERVER_BASE_URL = '/apis/notifications.alerting.grafana.app/v0alpha1';

export function paginatedHandlerFor(
  groups: PromRuleGroupDTO[]
): HttpResponseResolver<PathParams, DefaultBodyType, PromRulesResponse> {
  const orderedGroupsWithCursor = groups.map((group) => ({
    ...group,
    id: Buffer.from(`${group.file}-${group.name}`).toString('base64url'),
  }));

  return ({ request }) => {
    const { searchParams } = new URL(request.url);
    const groupLimitParam = searchParams.get('group_limit');
    const groupNextToken = searchParams.get('group_next_token');

    const groupLimit = groupLimitParam ? parseInt(groupLimitParam, 10) : undefined;

    const startIndex = groupNextToken ? orderedGroupsWithCursor.findIndex((group) => group.id === groupNextToken) : 0;
    const endIndex = groupLimit ? startIndex + groupLimit : orderedGroupsWithCursor.length;

    const groupsResult = orderedGroupsWithCursor.slice(startIndex, endIndex);
    const nextToken =
      groupLimit && orderedGroupsWithCursor.length > groupLimit ? orderedGroupsWithCursor.at(endIndex)?.id : undefined;

    return HttpResponse.json<PromRulesResponse>({
      status: 'success',
      data: { groups: groupsResult, groupNextToken: nextToken },
    });
  };
}
