import {
  type TypedUseMutationResult,
  type TypedUseQueryHookResult,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import { OverrideProperties } from 'type-fest';

import { CreateReceiverApiArg, type ListReceiverApiArg, alertingAPI } from '../../../api/v0alpha1/api.gen';
import type { ContactPoint, EnhancedListReceiverApiResponse } from '../../../api/v0alpha1/types';

// this is a workaround for the fact that the generated types are not narrow enough
type ListContactPointsHookResult = TypedUseQueryHookResult<
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
export function useListContactPoints() {
  return alertingAPI.useListReceiverQuery<ListContactPointsHookResult>(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true }
  );
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
  typeof alertingAPI.endpoints.createReceiver.useMutation<CreateContactPointMutation>
>[0];

/**
 * useCreateContactPoint is a hook that creates a new contact point with one or more integrations
 *
 * This function wraps the alertingAPI.useCreateReceiverMutation with proper typing
 * to ensure that the payload supports type narrowing.
 */
export function useCreateContactPoint(options?: UseCreateContactPointOptions) {
  const [updateFn, result] = alertingAPI.endpoints.createReceiver.useMutation<CreateContactPointMutation>(options);

  const typedUpdateFn = (args: CreateContactPointArgs) => {
    // @ts-expect-error this one is just impossible for me to figure out
    const response = updateFn(args);
    return response;
  };

  return [typedUpdateFn, result] as const;
}
