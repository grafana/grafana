import { useCallback } from 'react';

import { useDispatch } from 'app/types/store';
import { DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';
import { PromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { PromRulesResponse, prometheusApi } from '../../api/prometheusApi';

const { useLazyGetGroupsQuery, useLazyGetGrafanaGroupsQuery } = prometheusApi;

interface UseGeneratorHookOptions {
  populateCache?: boolean;
}

interface FetchGroupsOptions {
  groupLimit?: number;
  groupNextToken?: string;
}

export function usePrometheusGroupsGenerator(hookOptions: UseGeneratorHookOptions = {}) {
  const dispatch = useDispatch();
  const [getGroups] = useLazyGetGroupsQuery();

  return useCallback(
    async function* (ruleSource: DataSourceRulesSourceIdentifier, groupLimit: number) {
      const getRuleSourceGroupsWithCache = async (fetchOptions: FetchGroupsOptions) => {
        const response = await getGroups({
          ruleSource: { uid: ruleSource.uid },
          notificationOptions: { showErrorAlert: false },
          ...fetchOptions,
        }).unwrap();

        if (hookOptions.populateCache) {
          response.data.groups.forEach((group) => {
            dispatch(
              prometheusApi.util.upsertQueryData(
                'getGroups',
                { ruleSource: { uid: ruleSource.uid }, namespace: group.file, groupName: group.name },
                { data: { groups: [group] }, status: 'success' }
              )
            );
          });
        }

        return response;
      };

      yield* genericGroupsGenerator(getRuleSourceGroupsWithCache, groupLimit);
    },
    [getGroups, dispatch, hookOptions.populateCache]
  );
}

export function useGrafanaGroupsGenerator(hookOptions: UseGeneratorHookOptions = {}) {
  const dispatch = useDispatch();
  const [getGrafanaGroups] = useLazyGetGrafanaGroupsQuery();

  const getGroupsAndProvideCache = useCallback(
    async (fetchOptions: FetchGroupsOptions) => {
      const response = await getGrafanaGroups(fetchOptions).unwrap();

      // This is not mandatory to preload ruler rules, but it improves the UX
      // Because the user waits a bit longer for the initial load but doesn't need to wait for each group to be loaded
      if (hookOptions.populateCache) {
        const cacheAndRulerPreload = response.data.groups.map(async (group) => {
          dispatch(
            alertRuleApi.util.prefetch(
              'getGrafanaRulerGroup',
              { folderUid: group.folderUid, groupName: group.name },
              { force: true }
            )
          );
          await dispatch(
            prometheusApi.util.upsertQueryData(
              'getGrafanaGroups',
              { folderUid: group.folderUid, groupName: group.name },
              { data: { groups: [group] }, status: 'success' }
            )
          );
        });

        await Promise.allSettled(cacheAndRulerPreload);
      }

      return response;
    },
    [getGrafanaGroups, dispatch, hookOptions.populateCache]
  );

  return useCallback(
    async function* (groupLimit: number) {
      yield* genericGroupsGenerator(getGroupsAndProvideCache, groupLimit);
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
