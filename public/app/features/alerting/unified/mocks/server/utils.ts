import { type DefaultBodyType, HttpResponse, type HttpResponseResolver, type PathParams } from 'msw';

import { base64UrlEncode } from '@grafana/alerting';
import { type PromRuleGroupDTO, type PromRulesResponse } from 'app/types/unified-alerting-dto';

/** Helper method to help generate a kubernetes-style response with a list of items */
export const getK8sResponse = <T>(kind: string, items: T[]) => {
  return {
    kind,
    apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
    metadata: {},
    items,
  };
};

/**
 * Expected base URL for our k8s APIs. Uses a wildcard for the API version segment so that the
 * MSW handlers below intercept requests regardless of whether the runtime is configured to talk
 * to v0alpha1 or v1beta1 (toggled via `alerting.notificationsAPIV1Beta1`). The version segment is
 * never consumed by the handlers; this is purely about matching either URL.
 */
export const ALERTING_API_SERVER_BASE_URL = '/apis/notifications.alerting.grafana.app/:apiVersion';

export function paginatedHandlerFor(
  groups: PromRuleGroupDTO[]
): HttpResponseResolver<PathParams, DefaultBodyType, PromRulesResponse> {
  const orderedGroupsWithCursor = groups.map((group) => ({
    ...group,
    id: base64UrlEncode(`${group.file}-${group.name}`),
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
