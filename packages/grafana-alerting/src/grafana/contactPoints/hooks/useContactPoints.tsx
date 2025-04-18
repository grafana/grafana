import { fetchBaseQuery, TypedUseQueryHookResult } from '@reduxjs/toolkit/query/react';

import { config } from '@grafana/runtime';

import { alertingAPI, ListReceiverApiArg } from '../../api.gen';
import { EnhancedListReceiverResponse } from '../types';

const { namespace } = config;

// this is a workaround for the fact that the generated types are not narrow enough
type EnhancedHookResult = TypedUseQueryHookResult<
  EnhancedListReceiverResponse,
  ListReceiverApiArg,
  ReturnType<typeof fetchBaseQuery>
>;

/**
 * Enhanced hook that returns ContactPoints query result
 * with properly typed data.items as ContactPoint[]
 */
function useListContactPoints() {
  const result = alertingAPI.useListReceiverQuery<EnhancedHookResult>({ namespace });
  return result;
}

export { useListContactPoints };
