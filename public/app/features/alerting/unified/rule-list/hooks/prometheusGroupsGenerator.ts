import { BaseQueryFn } from '@reduxjs/toolkit/query';
import { TypedLazyQueryTrigger } from '@reduxjs/toolkit/query/react';
import { useCallback } from 'react';

import { ExternalRulesSourceIdentifier } from 'app/types/unified-alerting';

import { BaseQueryFnArgs } from '../../api/alertingApi';
import { prometheusApi, PromRulesResponse } from '../../api/prometheusApi';

const { useLazyGetGroupsQuery, useLazyGetGrafanaGroupsQuery } = prometheusApi;

interface FetchGroupsOptions {
  groupLimit?: number;
  groupNextToken?: string;
}

export function useRuleGroupsGenerator() {
  const [getGroups] = useLazyGetGroupsQuery();
  const [getGrafanaGroups] = useLazyGetGrafanaGroupsQuery();

  const prometheusGroupsGenerator = useCallback(
    async function* (ruleSource: ExternalRulesSourceIdentifier, groupLimit: number) {
      const getRuleSourceGroups = (options: FetchGroupsOptions) =>
        getGroups({ ruleSource: { uid: ruleSource.uid }, ...options });

      for await (const group of genericGroupsGenerator(getRuleSourceGroups, groupLimit)) {
        yield [ruleSource, group] as const;
      }
    },
    [getGroups]
  );

  const grafanaGroupsGenerator = useCallback(
    async function* (groupLimit: number) {
      yield* genericGroupsGenerator(getGrafanaGroups, groupLimit);
    },
    [getGrafanaGroups]
  );

  return { prometheusGroupsGenerator, grafanaGroupsGenerator };
}

// Generator lazily provides groups one by one only when needed
// This might look a bit complex but it allows us to have one API for paginated and non-paginated Prometheus data sources
// For unpaginated data sources we fetch everything in one go
// For paginated we fetch the next page when needed
async function* genericGroupsGenerator<TGroup>(
  fetchGroups: TypedLazyQueryTrigger<PromRulesResponse<TGroup>, FetchGroupsOptions, BaseQueryFn<BaseQueryFnArgs>>,
  groupLimit: number
) {
  const response = await fetchGroups({ groupLimit });

  if (!response.isSuccess) {
    return;
  }

  if (response.data?.data) {
    yield* response.data.data.groups;
  }

  let lastToken: string | undefined = undefined;
  if (response.data?.data?.groupNextToken) {
    lastToken = response.data.data.groupNextToken;
  }

  while (lastToken) {
    const response = await fetchGroups({
      groupNextToken: lastToken,
      groupLimit: groupLimit,
    });

    if (!response.isSuccess) {
      return;
    }

    if (response.data?.data) {
      yield* response.data.data.groups;
    }

    lastToken = response.data?.data?.groupNextToken;
  }
}
