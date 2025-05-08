import { TypedUseQueryHookResult, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';

import { ListReceiverApiArg, alertingAPI } from '../../api.gen';
import { EnhancedListReceiverResponse } from '../types';

const { namespace } = config;

// this is a workaround for the fact that the generated types are not narrow enough
type EnhancedHookResult = TypedUseQueryHookResult<
  EnhancedListReceiverResponse,
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
function useListContactPoints() {
  return alertingAPI.useListReceiverQuery<EnhancedHookResult>({ namespace });
}

export { useListContactPoints };
