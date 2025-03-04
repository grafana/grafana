import { createRelativeUrl } from './url';

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
