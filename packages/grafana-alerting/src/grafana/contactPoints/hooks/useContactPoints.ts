import {
  type TypedUseMutationResult,
  type TypedUseQueryHookResult,
  type fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import { type OverrideProperties } from 'type-fest';

import { type CreateReceiverApiArg, type ListReceiverApiArg, notificationsAPI } from '../../api/notifications';
import type { ContactPoint, EnhancedListReceiverApiResponse } from '../../api/notifications/types';

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

// type narrowing mutations requires us to define a few helper types
type CreateContactPointArgs = OverrideProperties<
  CreateReceiverApiArg,
  { receiver: Omit<ContactPoint, 'status' | 'metadata'> }
>;

type CreateContactPointMutation = TypedUseMutationResult<
  ContactPoint,
  CreateContactPointArgs,
  ReturnType<typeof fetchBaseQuery>
>;

type UseCreateContactPointOptions = Parameters<
  typeof notificationsAPI.endpoints.createReceiver.useMutation<CreateContactPointMutation>
>[0];

/**
 * useCreateContactPoint is a hook that creates a new contact point with one or more integrations
 *
 * This function wraps the notificationsAPI.useCreateReceiverMutation with proper typing
 * to ensure that the payload supports type narrowing.
 */
export function useCreateContactPoint(
  options?: UseCreateContactPointOptions
): readonly [
  (
    args: CreateContactPointArgs
  ) => ReturnType<ReturnType<typeof notificationsAPI.endpoints.createReceiver.useMutation>[0]>,
  ReturnType<typeof notificationsAPI.endpoints.createReceiver.useMutation<CreateContactPointMutation>>[1],
] {
  const [updateFn, result] = notificationsAPI.endpoints.createReceiver.useMutation<CreateContactPointMutation>(options);

  const typedUpdateFn = (args: CreateContactPointArgs) => {
    // @ts-expect-error this one is just impossible for me to figure out
    const response = updateFn(args);
    return response;
  };

  return [typedUpdateFn, result] as const;
}
