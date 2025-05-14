import { BaseQueryFn } from '@reduxjs/toolkit/query';
import { TypedLazyQueryTrigger } from '@reduxjs/toolkit/query/react';
import { useCallback } from 'react';

import { DataSourceRulesSourceIdentifier } from 'app/types/unified-alerting';

import { BaseQueryFnArgs } from '../../api/alertingApi';
import { PromRulesResponse, prometheusApi } from '../../api/prometheusApi';

const { useLazyGetGroupsQuery, useLazyGetGrafanaGroupsQuery } = prometheusApi;

interface FetchGroupsOptions {
  groupLimit?: number;
  groupNextToken?: string;
}

export function usePrometheusGroupsGenerator() {
  const [getGroups] = useLazyGetGroupsQuery();

  return useCallback(
    async function* (ruleSource: DataSourceRulesSourceIdentifier, groupLimit: number) {
      const getRuleSourceGroups = (options: FetchGroupsOptions) =>
        getGroups({ ruleSource: { uid: ruleSource.uid }, ...options });

      yield* genericGroupsGenerator(getRuleSourceGroups, groupLimit);
    },
    [getGroups]
  );
}

export function useGrafanaGroupsGenerator() {
  const [getGrafanaGroups] = useLazyGetGrafanaGroupsQuery();

  return useCallback(
    async function* (groupLimit: number) {
      yield* genericGroupsGenerator(getGrafanaGroups, groupLimit);
    },
    [getGrafanaGroups]
  );
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
