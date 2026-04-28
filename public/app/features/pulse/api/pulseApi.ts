import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '@grafana/api-clients/rtkq';

import {
  type AddPulseRequest,
  type CreateThreadRequest,
  type CreateThreadResult,
  type EditPulseRequest,
  type MarkReadRequest,
  type PageResult,
  type Pulse,
  type PulseThread,
  type ResourceKind,
  type ResourceVersion,
} from '../types';

interface ListThreadsArgs {
  resourceKind: ResourceKind;
  resourceUID: string;
  panelId?: number;
  cursor?: string;
  limit?: number;
}

interface ListPulsesArgs {
  threadUID: string;
  cursor?: string;
  limit?: number;
}

interface ResourceVersionArgs {
  resourceKind: ResourceKind;
  resourceUID: string;
}

/**
 * pulseApi is the RTK Query slice that wraps the /api/pulse REST surface.
 * Tag-based invalidation keeps the drawer's thread list and per-thread
 * pulse list in sync as the backend live channel pushes updates: the
 * useResourcePulseStream hook calls invalidateTags({ type: 'Thread', id })
 * on each event so RTK refetches lazily.
 */
export const pulseApi = createApi({
  reducerPath: 'pulseApi',
  baseQuery: createBaseQuery({ baseURL: '/api/pulse' }),
  tagTypes: ['Thread', 'Pulse', 'ResourceVersion', 'ResourceThreads'],
  endpoints: (builder) => ({
    listThreads: builder.query<PageResult<PulseThread>, ListThreadsArgs>({
      query: ({ resourceKind, resourceUID, panelId, cursor, limit }) => {
        const params: Record<string, string> = {
          resourceKind,
          resourceUID,
        };
        if (panelId !== undefined) {
          params.panelId = String(panelId);
        }
        if (cursor) {
          params.cursor = cursor;
        }
        if (limit !== undefined) {
          params.limit = String(limit);
        }
        return { url: '/threads', params };
      },
      providesTags: (result, _error, args) => {
        const tag = { type: 'ResourceThreads' as const, id: `${args.resourceKind}:${args.resourceUID}` };
        if (!result) {
          return [tag];
        }
        return [tag, ...result.items.map((t) => ({ type: 'Thread' as const, id: t.uid }))];
      },
    }),

    getThread: builder.query<PulseThread, string>({
      query: (uid) => ({ url: `/threads/${encodeURIComponent(uid)}` }),
      providesTags: (_r, _e, uid) => [{ type: 'Thread', id: uid }],
    }),

    listPulses: builder.query<PageResult<Pulse>, ListPulsesArgs>({
      query: ({ threadUID, cursor, limit }) => {
        const params: Record<string, string> = {};
        if (cursor) {
          params.cursor = cursor;
        }
        if (limit !== undefined) {
          params.limit = String(limit);
        }
        return { url: `/threads/${encodeURIComponent(threadUID)}/pulses`, params };
      },
      providesTags: (_r, _e, args) => [{ type: 'Pulse', id: args.threadUID }],
    }),

    createThread: builder.mutation<CreateThreadResult, CreateThreadRequest>({
      query: (body) => ({ url: '/threads', method: 'POST', body }),
      invalidatesTags: (_r, _e, args) => [
        { type: 'ResourceThreads', id: `${args.resourceKind}:${args.resourceUID}` },
        { type: 'ResourceVersion', id: `${args.resourceKind}:${args.resourceUID}` },
      ],
    }),

    addPulse: builder.mutation<Pulse, { threadUID: string; req: AddPulseRequest }>({
      query: ({ threadUID, req }) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/pulses`,
        method: 'POST',
        body: req,
      }),
      invalidatesTags: (_r, _e, args) => [
        { type: 'Pulse', id: args.threadUID },
        { type: 'Thread', id: args.threadUID },
      ],
    }),

    editPulse: builder.mutation<Pulse, { pulseUID: string; threadUID: string; req: EditPulseRequest }>({
      query: ({ pulseUID, req }) => ({
        url: `/pulses/${encodeURIComponent(pulseUID)}`,
        method: 'PATCH',
        body: req,
      }),
      invalidatesTags: (_r, _e, args) => [{ type: 'Pulse', id: args.threadUID }],
    }),

    deletePulse: builder.mutation<void, { pulseUID: string; threadUID: string }>({
      query: ({ pulseUID }) => ({
        url: `/pulses/${encodeURIComponent(pulseUID)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, args) => [{ type: 'Pulse', id: args.threadUID }],
    }),

    subscribe: builder.mutation<void, string>({
      query: (threadUID) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/subscribe`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, threadUID) => [{ type: 'Thread', id: threadUID }],
    }),

    unsubscribe: builder.mutation<void, string>({
      query: (threadUID) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/unsubscribe`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, threadUID) => [{ type: 'Thread', id: threadUID }],
    }),

    markRead: builder.mutation<void, { threadUID: string; req: MarkReadRequest }>({
      query: ({ threadUID, req }) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/read`,
        method: 'POST',
        body: req,
      }),
      invalidatesTags: (_r, _e, args) => [{ type: 'Thread', id: args.threadUID }],
    }),

    getResourceVersion: builder.query<ResourceVersion, ResourceVersionArgs>({
      query: ({ resourceKind, resourceUID }) => ({
        url: `/resources/${encodeURIComponent(resourceKind)}/${encodeURIComponent(resourceUID)}/version`,
      }),
      providesTags: (_r, _e, args) => [{ type: 'ResourceVersion', id: `${args.resourceKind}:${args.resourceUID}` }],
    }),
  }),
});

export const {
  useListThreadsQuery,
  useGetThreadQuery,
  useListPulsesQuery,
  useCreateThreadMutation,
  useAddPulseMutation,
  useEditPulseMutation,
  useDeletePulseMutation,
  useSubscribeMutation,
  useUnsubscribeMutation,
  useMarkReadMutation,
  useGetResourceVersionQuery,
} = pulseApi;
