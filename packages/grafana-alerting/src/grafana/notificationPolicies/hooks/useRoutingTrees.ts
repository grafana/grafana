import { type TypedUseQueryHookResult, type fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  type ListRoutingTreeApiArg,
  type ListRoutingTreeApiResponse,
  generatedAPI as notificationsAPIv1beta1,
} from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

type ListRoutingTreesHookResult = TypedUseQueryHookResult<
  ListRoutingTreeApiResponse,
  ListRoutingTreeApiArg,
  ReturnType<typeof fetchBaseQuery>
>;

type ListRoutingTreesQueryArgs = Parameters<
  typeof notificationsAPIv1beta1.endpoints.listRoutingTree.useQuery<ListRoutingTreesHookResult>
>[0];

type ListRoutingTreesQueryOptions = Parameters<
  typeof notificationsAPIv1beta1.endpoints.listRoutingTree.useQuery<ListRoutingTreesHookResult>
>[1];

/**
 * useListRoutingTrees is a hook that fetches a list of routing trees (notification policy trees).
 *
 * This function wraps the notificationsAPIv1beta1.useListRoutingTreeQuery with proper typing.
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
  return notificationsAPIv1beta1.useListRoutingTreeQuery<ListRoutingTreesHookResult>(queryArgs, queryOptions);
}
