import {
  type TypedUseMutationResult,
  type TypedUseQueryHookResult,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import { OverrideProperties } from 'type-fest';

import {
  CreateReceiverApiArg,
  DeleteReceiverApiArg,
  type ListReceiverApiArg,
  ReplaceReceiverApiArg,
  alertingAPI,
} from '../../../api/v0alpha1/api.gen';
import type { ContactPoint, EnhancedListReceiverApiResponse } from '../../../api/v0alpha1/types';

import { useProvideContactPointEvents } from './useContactPointEvents';

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
  return alertingAPI.useListReceiverQuery<ListContactPointsHookResult>({});
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
  const { publishAdded } = useProvideContactPointEvents();
  const [updateFn, result] = alertingAPI.endpoints.createReceiver.useMutation<CreateContactPointMutation>(options);

  const typedUpdateFn = async (args: CreateContactPointArgs) => {
    // @ts-expect-error this one is just impossible for me to figure out
    const response = updateFn(args);

    // Publish event when contact point is successfully created
    try {
      const contactPoint = await response.unwrap();
      publishAdded(contactPoint);
    } catch {
      // Ignore errors, just don't publish the event
    }

    return response;
  };

  return [typedUpdateFn, result] as const;
}

// type narrowing for update mutations
type UpdateContactPointArgs = OverrideProperties<
  ReplaceReceiverApiArg,
  { receiver: Omit<ContactPoint, 'status' | 'metadata'> }
>;

type UpdateContactPointMutation = TypedUseMutationResult<
  ContactPoint,
  UpdateContactPointArgs,
  ReturnType<typeof fetchBaseQuery>
>;

type UseUpdateContactPointOptions = Parameters<
  typeof alertingAPI.endpoints.replaceReceiver.useMutation<UpdateContactPointMutation>
>[0];

/**
 * useUpdateContactPoint is a hook that updates an existing contact point
 *
 * This function wraps the alertingAPI.useReplaceReceiverMutation with proper typing
 * and publishes update events.
 */
export function useUpdateContactPoint(options?: UseUpdateContactPointOptions) {
  const { publishUpdated } = useProvideContactPointEvents();
  const [updateFn, result] = alertingAPI.endpoints.replaceReceiver.useMutation<UpdateContactPointMutation>(options);

  const typedUpdateFn = async (args: UpdateContactPointArgs) => {
    // @ts-expect-error this one is just impossible for me to figure out
    const response = updateFn(args);

    // Publish event when contact point is successfully updated
    try {
      const contactPoint = await response.unwrap();
      publishUpdated(contactPoint);
    } catch {
      // Ignore errors, just don't publish the event
    }

    return response;
  };

  return [typedUpdateFn, result] as const;
}

type UseDeleteContactPointOptions = Parameters<typeof alertingAPI.endpoints.deleteReceiver.useMutation>[0];

/**
 * useDeleteContactPoint is a hook that deletes a contact point
 *
 * This function wraps the alertingAPI.useDeleteReceiverMutation and publishes delete events.
 */
export function useDeleteContactPoint(options?: UseDeleteContactPointOptions) {
  const { publishDeleted } = useProvideContactPointEvents();
  const [deleteFn, result] = alertingAPI.endpoints.deleteReceiver.useMutation(options);

  const typedDeleteFn = async (args: DeleteReceiverApiArg) => {
    const response = deleteFn(args);

    // Publish event when contact point is successfully deleted
    try {
      await response.unwrap();
      publishDeleted(args.name);
    } catch {
      // Ignore errors, just don't publish the event
    }

    return response;
  };

  return [typedDeleteFn, result] as const;
}
