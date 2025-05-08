import { fetchBaseQuery, TypedUseQueryHookResult } from '@reduxjs/toolkit/query/react';

import { alertingAPI, type ListReceiverApiArg } from '../../api/v0alpha1/api.gen';
import type { EnhancedListReceiverApiResponse } from '../../api/v0alpha1/types';

// this is a workaround for the fact that the generated types are not narrow enough
type EnhancedHookResult = TypedUseQueryHookResult<
  EnhancedListReceiverApiResponse,
  ListReceiverApiArg,
  ReturnType<typeof fetchBaseQuery>
>;

/**
 * useListContactPoints is a hook that fetches a list of contact points
 *
 * This function wraps the alertingAPI.useListReceiverQuery with proper typing
 * to ensure that the returned ContactPoints are correctly typed in the data.items array.
 *
 * It automatically uses the configured namespace for the query.
 */
function useListContactPointsv0alpha1() {
  return alertingAPI.useListReceiverQuery<EnhancedHookResult>({});
}

export { useListContactPointsv0alpha1 };
