import { useCallback } from 'react';

import { useDispatch } from 'app/types/store';
import { DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { PromRulesResponse, prometheusApi } from '../../api/prometheusApi';

const { useLazyGetGroupsQuery, useLazyGetGrafanaGroupsQuery } = prometheusApi;

interface FetchGroupsOptions {
  groupLimit?: number;
  groupNextToken?: string;
}

export function usePrometheusGroupsGenerator() {
  const dispatch = useDispatch();
  const [getGroups] = useLazyGetGroupsQuery();

  return useCallback(
    async function* (ruleSource: DataSourceRulesSourceIdentifier, groupLimit: number) {
      const getRuleSourceGroupsWithCache = async (options: FetchGroupsOptions) => {
        const response = await getGroups({ ruleSource: { uid: ruleSource.uid }, ...options }).unwrap();

        response.data.groups.forEach((group) => {
          dispatch(
            prometheusApi.util.upsertQueryData(
              'getGroups',
              { ruleSource: { uid: ruleSource.uid }, namespace: group.file, groupName: group.name },
              { data: { groups: [group] }, status: 'success' }
            )
          );
        });

        return response;
      };

      yield* genericGroupsGenerator(getRuleSourceGroupsWithCache, groupLimit);
    },
    [getGroups, dispatch]
  );
}

export function useGrafanaGroupsGenerator() {
  const dispatch = useDispatch();
  const [getGrafanaGroups] = useLazyGetGrafanaGroupsQuery();

  const getGroupsAndProvideCache = useCallback(
    async (options: FetchGroupsOptions) => {
      const response = await getGrafanaGroups(options).unwrap();

      // This is not mandatory to preload ruler rules, but it improves the UX
      // Because the user waits a bit longer for the initial load but doesn't need to wait for each group to be loaded
      const cacheAndRulerPreload = response.data.groups.map(async (group) => {
        await dispatch(
          alertRuleApi.endpoints.getGrafanaRulerGroup.initiate({ folderUid: group.folderUid, groupName: group.name })
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

      return response;
    },
    [getGrafanaGroups, dispatch]
  );

  return useCallback(
    async function* (groupLimit: number) {
      yield* genericGroupsGenerator(getGroupsAndProvideCache, groupLimit);
    },
    [getGroupsAndProvideCache]
  );
}

// Generator lazily provides groups one by one only when needed
// This might look a bit complex but it allows us to have one API for paginated and non-paginated Prometheus data sources
// For unpaginated data sources we fetch everything in one go
// For paginated we fetch the next page when needed
async function* genericGroupsGenerator<TGroup>(
  fetchGroups: (options: FetchGroupsOptions) => Promise<PromRulesResponse<TGroup>>,
  groupLimit: number
) {
  let response: PromRulesResponse<TGroup> | undefined;
  try {
    response = await fetchGroups({ groupLimit });
    yield* response.data.groups;
  } catch (error) {
    return;
  }

  let lastToken: string | undefined = response.data?.groupNextToken;

  while (lastToken) {
    try {
      response = await fetchGroups({ groupNextToken: lastToken, groupLimit: groupLimit });

      yield* response.data.groups;
      lastToken = response.data?.groupNextToken;
    } catch (error) {
      return;
    }
  }
}
