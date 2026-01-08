import { useCallback } from 'react';

import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { PromRulesResponse, prometheusApi } from '../../api/prometheusApi';

const { useLazyGetGrafanaGroupsQuery } = prometheusApi;

/**
 * Generator that yields groups for a specific folder with pagination support
 */
export function useFolderGroupsGenerator(folderUid: string, limitAlerts = 0) {
  const [getGrafanaGroups] = useLazyGetGrafanaGroupsQuery();

  return useCallback(
    async function* (groupLimit: number) {
      const fetchGroups = async (groupNextToken?: string): Promise<PromRulesResponse<GrafanaPromRuleGroupDTO>> => {
        return getGrafanaGroups({
          folderUid,
          groupLimit,
          limitAlerts,
          groupNextToken,
        }).unwrap();
      };

      let response = await fetchGroups();
      yield response.data.groups;

      let lastToken = response.data?.groupNextToken;

      while (lastToken) {
        response = await fetchGroups(lastToken);
        yield response.data.groups;
        lastToken = response.data?.groupNextToken;
      }
    },
    [getGrafanaGroups, folderUid, limitAlerts]
  );
}

/**
 * Converts a generator yielding arrays of groups to a generator yielding groups one by one
 */
export async function* toIndividualGroups<TGroup>(
  generator: AsyncGenerator<TGroup[], void, unknown>
): AsyncGenerator<TGroup, void, unknown> {
  for await (const batch of generator) {
    for (const item of batch) {
      yield item;
    }
  }
}
