import { RuleIdentifier } from 'app/types/unified-alerting';

import { stringifyIdentifier } from './rule-id';
import { createRelativeUrl } from './url';

type QueryParams = ConstructorParameters<typeof URLSearchParams>[0];

export const createListFilterLink = (values: Array<[string, string]>) => {
  const params = new URLSearchParams([['search', values.map(([key, value]) => `${key}:"${value}"`).join(' ')]]);
  return createRelativeUrl(`/alerting/list`, params);
};

export const alertListPageLink = createRelativeUrl(`/alerting/list`);

export const groups = {
  detailsPageLink: (dsUid: string, namespaceId: string, groupName: string) =>
    createRelativeUrl(
      `/alerting/${dsUid}/namespaces/${encodeURIComponent(namespaceId)}/groups/${encodeURIComponent(groupName)}/view`
    ),
  editPageLink: (dsUid: string, namespaceId: string, groupName: string) =>
    createRelativeUrl(
      `/alerting/${dsUid}/namespaces/${encodeURIComponent(namespaceId)}/groups/${encodeURIComponent(groupName)}/edit`
    ),
};

export const rulesNav = {
  /**
   * Creates a link to the details page of a rule. Encodes the rules source name and rule identifier.
   */
  detailsPageLink: (rulesSourceName: string, ruleIdentifier: RuleIdentifier, params?: QueryParams) =>
    createRelativeUrl(
      `/alerting/${encodeURIComponent(rulesSourceName)}/${encodeURIComponent(stringifyIdentifier(ruleIdentifier))}/view`,
      params
    ),
};
