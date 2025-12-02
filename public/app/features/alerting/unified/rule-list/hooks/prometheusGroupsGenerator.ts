import { useCallback } from 'react';
import { MergeExclusive } from 'type-fest';

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

export function usePrometheusGroupsGenerator() {
  const [getGroups] = useLazyGetGroupsQuery();

  return useCallback(
    async function* (ruleSource: DataSourceRulesSourceIdentifier, groupLimit: number) {
      const getRuleSourceGroupsWithCache = async (fetchOptions: GroupsNextPageOptions) => {
        const response = await getGroups({
          ruleSource: { uid: ruleSource.uid },
          notificationOptions: { showErrorAlert: false },
          groupLimit,
          ...fetchOptions,
        }).unwrap();

        return response;
      };

      yield* genericGroupsGenerator(getRuleSourceGroupsWithCache);
    },
    [getGroups]
  );
}

interface GrafanaPromApiFilter {
  state?: PromAlertingRuleState[];
  health?: RuleHealth[];
  contactPoint?: string;
  title?: string;
  searchGroupName?: string;
  type?: 'alerting' | 'recording';
  dashboardUid?: string;
}

interface GrafanaFetchGroupsOptions extends GroupsNextPageOptions {
  filter?: GrafanaPromApiFilter;
  groupLimit?: number;
  // Limits the number of total rules returned across all groups
  // Rounds up to full groups, so the response may contain more rules than the group limit
  ruleLimit?: number;
}

export type GrafanaFetchGroupsLimit = MergeExclusive<{ groupLimit: number }, { ruleLimit: number }>;

export type DataSourceFetchGroupsLimit = { groupLimit: number };

export interface FetchGroupsLimitOptions {
  grafanaManagedLimit: GrafanaFetchGroupsLimit;
  datasourceManagedLimit: DataSourceFetchGroupsLimit;
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
    async function* (limit: GrafanaFetchGroupsLimit, filter?: GrafanaPromApiFilter) {
      const fetchGroups = (fetchOptions: GroupsNextPageOptions) =>
        getGroupsAndProvideCache({
          ...fetchOptions,
          filter,
          groupLimit: 'groupLimit' in limit ? limit.groupLimit : undefined,
          ruleLimit: 'ruleLimit' in limit ? limit.ruleLimit : undefined,
        });

      yield* genericGroupsGenerator(fetchGroups);
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

interface GroupsNextPageOptions {
  groupNextToken?: string;
}

// Generator lazily provides groups one by one only when needed
// This might look a bit complex but it allows us to have one API for paginated and non-paginated Prometheus data sources
// For unpaginated data sources we fetch everything in one go
// For paginated we fetch the next page when needed
async function* genericGroupsGenerator<TGroup>(
  fetchGroups: (options: GroupsNextPageOptions) => Promise<PromRulesResponse<TGroup>>
) {
  let response = await fetchGroups({ groupNextToken: undefined });
  yield response.data.groups;

  let lastToken: string | undefined = response.data?.groupNextToken;

  while (lastToken) {
    response = await fetchGroups({ groupNextToken: lastToken });
    yield response.data.groups;
    lastToken = response.data?.groupNextToken;
  }
}
