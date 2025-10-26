import { useCallback } from 'react';

import { DataSourceRulesSourceIdentifier, RuleHealth } from 'app/types/unified-alerting';
import { PromAlertingRuleState, PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { PromRulesResponse, prometheusApi, usePopulateGrafanaPrometheusApiCache } from '../../api/prometheusApi';

const { useLazyGetGroupsQuery, useLazyGetGrafanaGroupsQuery } = prometheusApi;

interface UseGeneratorHookOptions {
  /**
   * Whether to populate the RTKQ cache with the groups.
   * Populating cache might harm performance when fetching a lot of groups or fetching multiple pages
   */
  populateCache?: boolean;
  limitAlerts?: number;
}

interface FetchGroupsOptions {
  groupLimit?: number;
  groupNextToken?: string;
}

export function usePrometheusGroupsGenerator() {
  const [getGroups] = useLazyGetGroupsQuery();

  return useCallback(
    async function* (ruleSource: DataSourceRulesSourceIdentifier, groupLimit: number) {
      const getRuleSourceGroupsWithCache = async (fetchOptions: FetchGroupsOptions) => {
        const response = await getGroups({
          ruleSource: { uid: ruleSource.uid },
          notificationOptions: { showErrorAlert: false },
          ...fetchOptions,
        }).unwrap();

        return response;
      };

      yield* genericGroupsGenerator(getRuleSourceGroupsWithCache, groupLimit);
    },
    [getGroups]
  );
}

interface GrafanaPromApiFilter {
  state?: PromAlertingRuleState[];
  health?: RuleHealth[];
  contactPoint?: string;
}

interface GrafanaFetchGroupsOptions extends FetchGroupsOptions {
  filter?: GrafanaPromApiFilter;
}

export function useGrafanaGroupsGenerator(hookOptions: UseGeneratorHookOptions = {}) {
  const [getGrafanaGroups] = useLazyGetGrafanaGroupsQuery();
  const { populateGroupsResponseCache } = usePopulateGrafanaPrometheusApiCache();

  const getGroupsAndProvideCache = useCallback(
    async (fetchOptions: GrafanaFetchGroupsOptions) => {
      const response = await getGrafanaGroups({
        ...fetchOptions,
        limitAlerts: hookOptions.limitAlerts,
        ...fetchOptions.filter,
      }).unwrap();

      if (hookOptions.populateCache) {
        populateGroupsResponseCache(response.data.groups);
      }

      return response;
    },
    [getGrafanaGroups, hookOptions.limitAlerts, hookOptions.populateCache, populateGroupsResponseCache]
  );

  return useCallback(
    async function* (groupLimit: number, filter?: GrafanaPromApiFilter) {
      yield* genericGroupsGenerator(
        (fetchOptions) => getGroupsAndProvideCache({ ...fetchOptions, filter }),
        groupLimit
      );
    },
    [getGroupsAndProvideCache]
  );
}

/**
 * Converts a Prometheus groups generator yielding arrays of groups to a generator yielding groups one by one
 * @param generator - The paginated generator to convert
 * @returns A non-paginated generator that yields all groups from the original generator one by one
 */
export function toIndividualRuleGroups<TGroup extends PromRuleGroupDTO>(
  generator: AsyncGenerator<TGroup[], void, unknown>
): AsyncGenerator<TGroup, void, unknown> {
  return (async function* () {
    for await (const batch of generator) {
      for (const item of batch) {
        yield item;
      }
    }
  })();
}

// Generator lazily provides groups one by one only when needed
// This might look a bit complex but it allows us to have one API for paginated and non-paginated Prometheus data sources
// For unpaginated data sources we fetch everything in one go
// For paginated we fetch the next page when needed
async function* genericGroupsGenerator<TGroup>(
  fetchGroups: (options: FetchGroupsOptions) => Promise<PromRulesResponse<TGroup>>,
  groupLimit: number
) {
  let response = await fetchGroups({ groupLimit });
  yield response.data.groups;

  let lastToken: string | undefined = response.data?.groupNextToken;

  while (lastToken) {
    response = await fetchGroups({ groupNextToken: lastToken, groupLimit: groupLimit });
    yield response.data.groups;
    lastToken = response.data?.groupNextToken;
  }
}
