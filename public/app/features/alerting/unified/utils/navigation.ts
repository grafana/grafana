import { ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';
import { RuleGroupIdentifierV2, RuleIdentifier } from 'app/types/unified-alerting';

import { createReturnTo } from '../hooks/useReturnTo';

import { stringifyIdentifier } from './rule-id';
import { createRelativeUrl } from './url';

type QueryParams = ConstructorParameters<typeof URLSearchParams>[0];

export const createListFilterLink = (values: Array<[string, string]>, options?: { skipSubPath?: boolean }) => {
  const params = new URLSearchParams([['search', values.map(([key, value]) => `${key}:"${value}"`).join(' ')]]);
  return createRelativeUrl(`/alerting/list`, params, { skipSubPath: options?.skipSubPath });
};

export const alertListPageLink = (queryParams: Record<string, string> = {}, options?: { skipSubPath?: boolean }) =>
  createRelativeUrl(`/alerting/list`, queryParams, { skipSubPath: options?.skipSubPath });

export const groups = {
  detailsPageLink: (dsUid: string, namespaceId: string, groupName: string, options?: { includeReturnTo: boolean }) => {
    const params: Record<string, string> = options?.includeReturnTo ? { returnTo: createReturnTo() } : {};

    return createRelativeUrl(
      `/alerting/${dsUid}/namespaces/${encodeURIComponent(namespaceId)}/groups/${encodeURIComponent(groupName)}/view`,
      params
    );
  },
  detailsPageLinkFromGroupIdentifier: (groupIdentifier: RuleGroupIdentifierV2) => {
    const { groupOrigin, namespace, groupName } = groupIdentifier;
    const isGrafanaOrigin = groupOrigin === 'grafana';

    return isGrafanaOrigin
      ? groups.detailsPageLink('grafana', namespace.uid, groupName)
      : groups.detailsPageLink(groupIdentifier.rulesSource.uid, namespace.name, groupName);
  },
  editPageLink: (
    dsUid: string,
    namespaceId: string,
    groupName: string,
    options?: { includeReturnTo?: boolean; skipSubPath?: boolean }
  ) => {
    const params: Record<string, string> = options?.includeReturnTo ? { returnTo: createReturnTo() } : {};
    return createRelativeUrl(
      `/alerting/${dsUid}/namespaces/${encodeURIComponent(namespaceId)}/groups/${encodeURIComponent(groupName)}/edit`,
      params,
      { skipSubPath: options?.skipSubPath }
    );
  },
  newAlertRuleLink: (folderName?: string, folderUid?: string, groupName?: string) => {
    const returnTo = createReturnTo();

    const defaults = JSON.stringify({
      folder: {
        title: folderName,
        uid: folderUid,
      },
      group: groupName,
    });

    return createRelativeUrl('/alerting/new', { defaults, returnTo });
  },
  newRecordingRuleLink: (folderName?: string, folderUid?: string, groupName?: string) => {
    const returnTo = createReturnTo();

    const defaults = JSON.stringify({
      folder: {
        title: folderName,
        uid: folderUid,
      },
      group: groupName,
    });

    return createRelativeUrl('/alerting/new/grafana-recording', { defaults, returnTo });
  },
};

export const rulesNav = {
  /**
   * Creates a link to the details page of a rule. Encodes the rules source name and rule identifier.
   */
  detailsPageLink: (
    rulesSourceName: string,
    ruleIdentifier: RuleIdentifier,
    params?: QueryParams,
    options?: { skipSubPath?: boolean }
  ) =>
    createRelativeUrl(
      `/alerting/${encodeURIComponent(rulesSourceName)}/${encodeURIComponent(stringifyIdentifier(ruleIdentifier))}/view`,
      params,
      { skipSubPath: options?.skipSubPath }
    ),
};

export const notificationPolicies = {
  viewLink: (matchers: ObjectMatcher[], alertmanagerSourceName?: string) => {
    return createRelativeUrl('/alerting/routes', {
      queryString: matchers.map((matcher) => matcher.join('')).join(','),
      alertmanager: alertmanagerSourceName ?? 'grafana',
    });
  },
};
