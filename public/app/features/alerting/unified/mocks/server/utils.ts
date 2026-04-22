import { type DefaultBodyType, HttpResponse, type HttpResponseResolver, type PathParams } from 'msw';

import { base64UrlEncode } from '@grafana/alerting';
import { type PromRuleGroupDTO, PromRuleType, type PromRulesResponse } from 'app/types/unified-alerting-dto';

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
    id: base64UrlEncode(`${group.file}-${group.name}`),
  }));

  return ({ request }) => {
    const { searchParams } = new URL(request.url);
    const groupLimitParam = searchParams.get('group_limit');
    const groupNextToken = searchParams.get('group_next_token');
    const ruleTypeParam = searchParams.get('rule_type');

    // Apply server-side rule_type filtering to mirror real backend behavior:
    // rules of the wrong type are removed, and groups left with no rules are dropped.
    const typeFilteredGroups =
      ruleTypeParam === PromRuleType.Alerting || ruleTypeParam === PromRuleType.Recording
        ? orderedGroupsWithCursor
            .map((group) => ({ ...group, rules: group.rules.filter((rule) => rule.type === ruleTypeParam) }))
            .filter((group) => group.rules.length > 0)
        : orderedGroupsWithCursor;

    const groupLimit = groupLimitParam ? parseInt(groupLimitParam, 10) : undefined;

    const startIndex = groupNextToken ? typeFilteredGroups.findIndex((group) => group.id === groupNextToken) : 0;
    const endIndex = groupLimit ? startIndex + groupLimit : typeFilteredGroups.length;

    const groupsResult = typeFilteredGroups.slice(startIndex, endIndex);
    const nextToken =
      groupLimit && typeFilteredGroups.length > groupLimit ? typeFilteredGroups.at(endIndex)?.id : undefined;

    return HttpResponse.json<PromRulesResponse>({
      status: 'success',
      data: { groups: groupsResult, groupNextToken: nextToken },
    });
  };
}
