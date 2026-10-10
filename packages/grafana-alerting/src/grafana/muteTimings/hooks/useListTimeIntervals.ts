import { type TypedUseQueryHookResult, type fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  type ListTimeIntervalApiArg,
  type ListTimeIntervalApiResponse,
  notificationsAPI,
} from '../../api/notifications';

type ListTimeIntervalsHookResult = TypedUseQueryHookResult<
  ListTimeIntervalApiResponse,
  ListTimeIntervalApiArg,
  ReturnType<typeof fetchBaseQuery>
>;

type UseListTimeIntervalsQuery =
  typeof notificationsAPI.endpoints.listTimeInterval.useQuery<ListTimeIntervalsHookResult>;

/** Fetches TimeInterval resources. Mute and active timings share this one resource type; a rule's own
 * muteTimeIntervals/activeTimeIntervals field decides which side a name is used on. */
export function useListTimeIntervals(
  queryArgs: Parameters<UseListTimeIntervalsQuery>[0] = {},
  queryOptions: Parameters<UseListTimeIntervalsQuery>[1] = {}
): ListTimeIntervalsHookResult {
  return notificationsAPI.useListTimeIntervalQuery<ListTimeIntervalsHookResult>(queryArgs, queryOptions);
}
