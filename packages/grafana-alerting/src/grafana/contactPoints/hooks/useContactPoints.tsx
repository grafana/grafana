import { fetchBaseQuery, TypedUseQueryHookResult } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';

import { alertingAPIv0alpha1, type ListReceiverApiArg } from '../../api/api.v0alpha1.gen';
import type { EnhancedListReceiverv0alpha1ApiResponse } from '../types';

const { namespace } = config;

// this is a workaround for the fact that the generated types are not narrow enough
type EnhancedHookResult = TypedUseQueryHookResult<
  EnhancedListReceiverv0alpha1ApiResponse,
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
  return alertingAPIv0alpha1.useListReceiverQuery<EnhancedHookResult>({ namespace });
}

export { useListContactPointsv0alpha1 };
