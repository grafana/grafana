import { type TypedUseQueryHookResult, type fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  type EnhancedListReceiverApiResponse,
  type ListReceiverApiArg,
  notificationsAPI,
} from '../../../api/notifications';

// this is a workaround for the fact that the generated types are not narrow enough
type ListContactPointsHookResult = TypedUseQueryHookResult<
  EnhancedListReceiverApiResponse,
  ListReceiverApiArg,
  ReturnType<typeof fetchBaseQuery>
>;

// Type for the options that can be passed to the hook
// Based on the pattern used for mutation options in this file
type ListContactPointsQueryArgs = Parameters<
  typeof notificationsAPI.endpoints.listReceiver.useQuery<ListContactPointsHookResult>
>[0];

type ListContactPointsQueryOptions = Parameters<
  typeof notificationsAPI.endpoints.listReceiver.useQuery<ListContactPointsHookResult>
>[1];

/**
 * useListContactPoints is a hook that fetches a list of contact points
 *
 * This function wraps the notificationsAPI.useListReceiverQuery with proper typing
 * to ensure that the returned ContactPoints are correctly typed in the data.items array.
 *
 * It automatically uses the configured namespace for the query.
 *
 * @param queryOptions - Optional query options that will be passed to the underlying useListReceiverQuery hook.
 *                      These options can include refetchOnFocus, refetchOnMountOrArgChange, skip, etc.
 */
export function useListContactPoints(
  queryArgs: ListContactPointsQueryArgs = {},
  queryOptions: ListContactPointsQueryOptions = {}
): ListContactPointsHookResult {
  return notificationsAPI.useListReceiverQuery<ListContactPointsHookResult>(queryArgs, queryOptions);
}
