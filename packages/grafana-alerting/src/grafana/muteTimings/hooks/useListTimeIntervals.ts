import { type TypedUseQueryHookResult, type fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  type ListTimeIntervalApiArg,
  type ListTimeIntervalApiResponse,
  generatedAPI as notificationsAPIv1beta1,
} from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

type ListTimeIntervalsHookResult = TypedUseQueryHookResult<
  ListTimeIntervalApiResponse,
  ListTimeIntervalApiArg,
  ReturnType<typeof fetchBaseQuery>
>;

type ListTimeIntervalsQueryArgs = Parameters<
  typeof notificationsAPIv1beta1.endpoints.listTimeInterval.useQuery<ListTimeIntervalsHookResult>
>[0];

type ListTimeIntervalsQueryOptions = Parameters<
  typeof notificationsAPIv1beta1.endpoints.listTimeInterval.useQuery<ListTimeIntervalsHookResult>
>[1];

/** Fetches TimeInterval resources. Mute and active timings share this one resource type — a
 * rule's own muteTimeIntervals/activeTimeIntervals field decides which side a name is used on. */
export function useListTimeIntervals(
  queryArgs: ListTimeIntervalsQueryArgs = {},
  queryOptions: ListTimeIntervalsQueryOptions = {}
): ListTimeIntervalsHookResult {
  return notificationsAPIv1beta1.useListTimeIntervalQuery<ListTimeIntervalsHookResult>(queryArgs, queryOptions);
}
