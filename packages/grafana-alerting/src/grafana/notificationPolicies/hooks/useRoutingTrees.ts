import { type TypedUseQueryHookResult, type fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { type ListRoutingTreeApiArg, type ListRoutingTreeApiResponse, notificationsAPI } from '../../api/notifications';

type ListRoutingTreesHookResult = TypedUseQueryHookResult<
  ListRoutingTreeApiResponse,
  ListRoutingTreeApiArg,
  ReturnType<typeof fetchBaseQuery>
>;

type ListRoutingTreesQueryArgs = Parameters<
  typeof notificationsAPI.endpoints.listRoutingTree.useQuery<ListRoutingTreesHookResult>
>[0];

type ListRoutingTreesQueryOptions = Parameters<
  typeof notificationsAPI.endpoints.listRoutingTree.useQuery<ListRoutingTreesHookResult>
>[1];

/**
 * useListRoutingTrees is a hook that fetches a list of routing trees (notification policy trees).
 *
 * This function wraps the notificationsAPI.useListRoutingTreeQuery with proper typing.
 *
 * The backend returns all available routing trees.
 *
 * @param queryArgs - Optional query arguments for filtering, pagination, etc.
 * @param queryOptions - Optional query options (refetchOnFocus, skip, etc.)
 */
export function useListRoutingTrees(
  queryArgs: ListRoutingTreesQueryArgs = {},
  queryOptions: ListRoutingTreesQueryOptions = {}
): ListRoutingTreesHookResult {
  return notificationsAPI.useListRoutingTreeQuery<ListRoutingTreesHookResult>(queryArgs, queryOptions);
}
