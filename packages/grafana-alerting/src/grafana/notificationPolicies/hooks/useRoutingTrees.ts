import { type TypedUseQueryHookResult, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  ListRoutingTreeApiArg,
  ListRoutingTreeApiResponse,
  generatedAPI as notificationsAPIv0alpha1,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

type ListRoutingTreesHookResult = TypedUseQueryHookResult<
  ListRoutingTreeApiResponse,
  ListRoutingTreeApiArg,
  ReturnType<typeof fetchBaseQuery>
>;

type ListRoutingTreesQueryArgs = Parameters<
  typeof notificationsAPIv0alpha1.endpoints.listRoutingTree.useQuery<ListRoutingTreesHookResult>
>[0];

type ListRoutingTreesQueryOptions = Parameters<
  typeof notificationsAPIv0alpha1.endpoints.listRoutingTree.useQuery<ListRoutingTreesHookResult>
>[1];

/**
 * useListRoutingTrees is a hook that fetches a list of routing trees (notification policy trees).
 *
 * This function wraps the notificationsAPIv0alpha1.useListRoutingTreeQuery with proper typing.
 *
 * When the `alertingMultiplePolicies` feature toggle is enabled on the backend, this returns all
 * available routing trees. Otherwise, it returns only the default "user-defined" tree.
 *
 * @param queryArgs - Optional query arguments for filtering, pagination, etc.
 * @param queryOptions - Optional query options (refetchOnFocus, skip, etc.)
 */
export function useListRoutingTrees(
  queryArgs: ListRoutingTreesQueryArgs = {},
  queryOptions: ListRoutingTreesQueryOptions = {}
): ListRoutingTreesHookResult {
  return notificationsAPIv0alpha1.useListRoutingTreeQuery<ListRoutingTreesHookResult>(queryArgs, queryOptions);
}
