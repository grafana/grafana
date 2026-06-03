import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '@grafana/api-clients/rtkq';

import {
  type AddAssistantReplyRequest,
  type AddPulseRequest,
  type CreateThreadRequest,
  type CreateThreadResult,
  type EditPulseRequest,
  type MarkReadRequest,
  type PageResult,
  type PanelMentionsResponse,
  type ParticipantsResponse,
  type Pulse,
  type PulseThread,
  type ResourceKind,
  type ResourceVersion,
} from '../types';

interface ListThreadsArgs {
  resourceKind: ResourceKind;
  resourceUID: string;
  panelId?: number;
  /**
   * When set, narrows the result to threads the user started or
   * replied on (matches the backend's AuthorUserID filter, which
   * widens to repliers — not just thread starters). Powers the
   * "Users" filter dropdown in the per-resource Pulse drawer.
   */
  authorUserId?: number;
  /**
   * Free-form substring search. Matches against the thread title or
   * the body_text of any non-deleted pulse on the thread, so a hit
   * inside a reply still surfaces its parent. Empty / whitespace-only
   * values are treated as no filter by the backend.
   */
  q?: string;
  /** When true, narrows to threads the caller created, replied on, or
   *  subscribed to. Mirrors the global overview's `mine` flag so
   *  per-resource surfaces (folder Pulse tab) can offer the same
   *  "Mine / All" scope toggle. */
  mine?: boolean;
  /** Narrows to open or closed threads. Omit (or pass undefined) for
   *  "any"; the backend treats the missing param as no filter. */
  status?: ThreadStatusFilter;
  /** 1-indexed page; the drawer pager renders numbered buttons that
   *  jump straight to a page rather than walking forwards. */
  page?: number;
  limit?: number;
}

interface ListPulsesArgs {
  threadUID: string;
  cursor?: string;
  limit?: number;
}

/**
 * Open / closed are the only valid wire values for the status filter;
 * a missing field is the "any" default. Mirrors the backend's
 * ThreadStatusFilter so a typo in the union catches at compile time.
 */
export type ThreadStatusFilter = 'open' | 'closed';

interface ListAllThreadsArgs {
  q?: string;
  mine?: boolean;
  status?: ThreadStatusFilter;
  page?: number;
  limit?: number;
}

/**
 * ListFolderRollupThreadsArgs powers the folder Pulse tab. The
 * folder isn't a Pulse resource — instead the backend resolves the
 * folder hierarchy (root + descendants) into a dashboard set and
 * returns the threads attached to those dashboards. Filter shape
 * mirrors the per-resource list so the surface can offer the same
 * Status / Mine / search / Users dropdown.
 */
interface ListFolderRollupThreadsArgs {
  folderUID: string;
  authorUserId?: number;
  q?: string;
  mine?: boolean;
  status?: ThreadStatusFilter;
  page?: number;
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
  tagTypes: [
    'Thread',
    'Pulse',
    'ResourceVersion',
    'ResourceThreads',
    'AllThreads',
    'FolderRollupThreads',
    'PanelMentions',
    'Participants',
  ],
  endpoints: (builder) => ({
    listThreads: builder.query<PageResult<PulseThread>, ListThreadsArgs>({
      query: ({ resourceKind, resourceUID, panelId, authorUserId, q, mine, status, page, limit }) => {
        const params: Record<string, string> = {
          resourceKind,
          resourceUID,
        };
        if (panelId !== undefined) {
          params.panelId = String(panelId);
        }
        if (authorUserId !== undefined) {
          params.authorUserId = String(authorUserId);
        }
        // Trim before sending: a whitespace-only query would still
        // produce a distinct cache key on RTK Query's side, leading
        // to needless refetches as the user types and immediately
        // backspaces past their last non-whitespace character.
        const trimmedQ = q?.trim();
        if (trimmedQ) {
          params.q = trimmedQ;
        }
        if (mine) {
          // Omit when false so an unchecked toggle doesn't produce a
          // distinct cache key from "no toggle at all". Same shape the
          // /threads/all endpoint already uses.
          params.mine = 'true';
        }
        if (status) {
          // "any" is encoded by omission (matches the backend's
          // ThreadStatusAny zero value) so the URL stays clean.
          params.status = status;
        }
        if (page !== undefined && page > 1) {
          // Page 1 is the default; omitting the param keeps the URL
          // clean for the common case.
          params.page = String(page);
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

    listAllThreads: builder.query<PageResult<PulseThread>, ListAllThreadsArgs>({
      query: ({ q, mine, status, page, limit }) => {
        const params: Record<string, string> = {};
        if (q) {
          params.q = q;
        }
        if (mine) {
          params.mine = 'true';
        }
        if (status) {
          // Only "open" and "closed" reach the wire; "all" is encoded
          // by omitting the parameter entirely so the URL stays clean.
          params.status = status;
        }
        if (page !== undefined) {
          params.page = String(page);
        }
        if (limit !== undefined) {
          params.limit = String(limit);
        }
        return { url: '/threads/all', params };
      },
      providesTags: (result) => {
        // The overview is its own tag bucket so write-side mutations
        // anywhere in the org bust just this list (we always invalidate
        // 'AllThreads' alongside the per-resource tag).
        if (!result) {
          return [{ type: 'AllThreads' as const, id: 'LIST' }];
        }
        return [
          { type: 'AllThreads' as const, id: 'LIST' },
          ...result.items.map((t) => ({ type: 'Thread' as const, id: t.uid })),
        ];
      },
    }),

    /**
     * listFolderRollupThreads aggregates dashboard-scoped threads for
     * every dashboard the caller can read under the given folder
     * hierarchy. The folder itself is not a Pulse resource, so this
     * lives on a dedicated route. Each row is decorated server-side
     * with `resourceTitle` (dashboard title), `folderUID`, and
     * `folderTitle` so the table renders Type / Resource / Folder
     * columns without per-row lookups.
     */
    listFolderRollupThreads: builder.query<PageResult<PulseThread>, ListFolderRollupThreadsArgs>({
      query: ({ folderUID, authorUserId, q, mine, status, page, limit }) => {
        const params: Record<string, string> = {};
        if (authorUserId !== undefined) {
          params.authorUserId = String(authorUserId);
        }
        const trimmedQ = q?.trim();
        if (trimmedQ) {
          params.q = trimmedQ;
        }
        if (mine) {
          params.mine = 'true';
        }
        if (status) {
          params.status = status;
        }
        if (page !== undefined && page > 1) {
          params.page = String(page);
        }
        if (limit !== undefined) {
          params.limit = String(limit);
        }
        return { url: `/folders/${encodeURIComponent(folderUID)}/threads`, params };
      },
      providesTags: (result, _error, args) => {
        // Two tags per response: one keyed on this folder's UID
        // (so a manual refetch on that surface only busts its own
        // bucket), and a shared LIST sentinel (so write-side
        // mutations that don't know the folder context — like
        // createThread, which only knows the dashboard — can still
        // invalidate every folder rollup that might contain the
        // affected dashboard).
        const folderTag = { type: 'FolderRollupThreads' as const, id: args.folderUID };
        const listTag = { type: 'FolderRollupThreads' as const, id: 'LIST' };
        if (!result) {
          return [folderTag, listTag];
        }
        return [folderTag, listTag, ...result.items.map((t) => ({ type: 'Thread' as const, id: t.uid }))];
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
      query: (body) => ({
        url: '/threads',
        method: 'POST',
        body,
        // The createThread response is the new thread + pulse; backend_srv
        // only auto-emits a success toast when the response carries a
        // `message` field, so this stays silent without further config.
        showSuccessAlert: false,
      }),
      invalidatesTags: (_r, _e, args) => [
        { type: 'ResourceThreads', id: `${args.resourceKind}:${args.resourceUID}` },
        { type: 'ResourceVersion', id: `${args.resourceKind}:${args.resourceUID}` },
        { type: 'PanelMentions', id: `${args.resourceKind}:${args.resourceUID}` },
        // A new thread always introduces at least the author into the
        // participants set, so bust the dropdown's cache.
        { type: 'Participants', id: `${args.resourceKind}:${args.resourceUID}` },
        { type: 'AllThreads', id: 'LIST' },
        // The dashboard could live under any folder hierarchy, so we
        // bust every folder rollup via the shared LIST sentinel
        // rather than trying to figure out the parent folder here.
        { type: 'FolderRollupThreads', id: 'LIST' },
      ],
    }),

    deleteThread: builder.mutation<void, { threadUID: string; resourceKind: ResourceKind; resourceUID: string }>({
      query: ({ threadUID }) => ({
        url: `/threads/${encodeURIComponent(threadUID)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, args) => [
        { type: 'ResourceThreads', id: `${args.resourceKind}:${args.resourceUID}` },
        { type: 'PanelMentions', id: `${args.resourceKind}:${args.resourceUID}` },
        // Removing a thread can drop a participant who only commented
        // there from the rollup; refresh the dropdown.
        { type: 'Participants', id: `${args.resourceKind}:${args.resourceUID}` },
        { type: 'Thread', id: args.threadUID },
        { type: 'AllThreads', id: 'LIST' },
        { type: 'FolderRollupThreads', id: 'LIST' },
      ],
    }),

    closeThread: builder.mutation<PulseThread, { threadUID: string; resourceKind: ResourceKind; resourceUID: string }>({
      query: ({ threadUID }) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/close`,
        method: 'POST',
        showSuccessAlert: false,
      }),
      invalidatesTags: (_r, _e, args) => [
        { type: 'ResourceThreads', id: `${args.resourceKind}:${args.resourceUID}` },
        // Closed threads drop out of the panel-mentions rollup; bust
        // the cache so the icon disappears immediately for the actor.
        { type: 'PanelMentions', id: `${args.resourceKind}:${args.resourceUID}` },
        { type: 'Thread', id: args.threadUID },
        { type: 'AllThreads', id: 'LIST' },
        { type: 'FolderRollupThreads', id: 'LIST' },
      ],
    }),

    reopenThread: builder.mutation<PulseThread, { threadUID: string; resourceKind: ResourceKind; resourceUID: string }>(
      {
        query: ({ threadUID }) => ({
          url: `/threads/${encodeURIComponent(threadUID)}/reopen`,
          method: 'POST',
          showSuccessAlert: false,
        }),
        invalidatesTags: (_r, _e, args) => [
          { type: 'ResourceThreads', id: `${args.resourceKind}:${args.resourceUID}` },
          // Reopening puts the thread back into the panel-mentions
          // rollup; same reason as closeThread.
          { type: 'PanelMentions', id: `${args.resourceKind}:${args.resourceUID}` },
          { type: 'Thread', id: args.threadUID },
          { type: 'AllThreads', id: 'LIST' },
          { type: 'FolderRollupThreads', id: 'LIST' },
        ],
      }
    ),

    addPulse: builder.mutation<Pulse, { threadUID: string; req: AddPulseRequest }>({
      query: ({ threadUID, req }) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/pulses`,
        method: 'POST',
        body: req,
        showSuccessAlert: false,
      }),
      // We don't carry resourceKind/UID through the addPulse request
      // (the thread already knows its resource), so we can't safely
      // bust the per-resource Participants tag here. The live channel
      // (`useResourcePulseStream`) already invalidates Participants
      // alongside other tags on every pulse-changed event, so the
      // dropdown still refreshes within the live round-trip.
      invalidatesTags: (_r, _e, args) => [
        { type: 'Pulse', id: args.threadUID },
        { type: 'Thread', id: args.threadUID },
        { type: 'AllThreads', id: 'LIST' },
        { type: 'FolderRollupThreads', id: 'LIST' },
      ],
    }),

    // Persists a Grafana Assistant reply (generated client-side) under the
    // assistant service account. Same cache invalidation as addPulse so the
    // assistant's answer shows up in the open thread and bumps the list.
    // Errors are silenced: a failed auto-reply must never surface a toast
    // over the user's own (already successful) pulse.
    addAssistantReply: builder.mutation<Pulse, { threadUID: string; req: AddAssistantReplyRequest }>({
      query: ({ threadUID, req }) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/assistant-reply`,
        method: 'POST',
        body: req,
        showSuccessAlert: false,
        showErrorAlert: false,
      }),
      invalidatesTags: (_r, _e, args) => [
        { type: 'Pulse', id: args.threadUID },
        { type: 'Thread', id: args.threadUID },
        { type: 'AllThreads', id: 'LIST' },
        { type: 'FolderRollupThreads', id: 'LIST' },
      ],
    }),

    editPulse: builder.mutation<Pulse, { pulseUID: string; threadUID: string; req: EditPulseRequest }>({
      query: ({ pulseUID, req }) => ({
        url: `/pulses/${encodeURIComponent(pulseUID)}`,
        method: 'PATCH',
        body: req,
        showSuccessAlert: false,
      }),
      invalidatesTags: (_r, _e, args) => [{ type: 'Pulse', id: args.threadUID }],
    }),

    deletePulse: builder.mutation<void, { pulseUID: string; threadUID: string }>({
      query: ({ pulseUID }) => ({
        url: `/pulses/${encodeURIComponent(pulseUID)}`,
        method: 'DELETE',
        showSuccessAlert: false,
      }),
      invalidatesTags: (_r, _e, args) => [{ type: 'Pulse', id: args.threadUID }],
    }),

    subscribe: builder.mutation<void, string>({
      query: (threadUID) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/subscribe`,
        method: 'POST',
        showSuccessAlert: false,
      }),
      invalidatesTags: (_r, _e, threadUID) => [{ type: 'Thread', id: threadUID }],
    }),

    unsubscribe: builder.mutation<void, string>({
      query: (threadUID) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/unsubscribe`,
        method: 'POST',
        showSuccessAlert: false,
      }),
      invalidatesTags: (_r, _e, threadUID) => [{ type: 'Thread', id: threadUID }],
    }),

    markRead: builder.mutation<void, { threadUID: string; req: MarkReadRequest }>({
      query: ({ threadUID, req }) => ({
        url: `/threads/${encodeURIComponent(threadUID)}/read`,
        method: 'POST',
        body: req,
        // Mark-as-read fires on every thread open; surfacing a success
        // toast would be relentless. Errors are non-fatal — the user can
        // still read the thread — so we silence those too.
        showSuccessAlert: false,
        showErrorAlert: false,
      }),
      invalidatesTags: (_r, _e, args) => [{ type: 'Thread', id: args.threadUID }],
    }),

    getResourceVersion: builder.query<ResourceVersion, ResourceVersionArgs>({
      query: ({ resourceKind, resourceUID }) => ({
        url: `/resources/${encodeURIComponent(resourceKind)}/${encodeURIComponent(resourceUID)}/version`,
      }),
      providesTags: (_r, _e, args) => [{ type: 'ResourceVersion', id: `${args.resourceKind}:${args.resourceUID}` }],
    }),

    /**
     * One round-trip per dashboard returns the rollup for every panel
     * with open Pulse activity. The PanelPulseMentions scene title-item
     * mounts on every viz panel but RTK Query dedupes the call by
     * `${resourceKind}:${resourceUID}`, so a 50-panel dashboard makes
     * exactly one request and each panel selects its own row from the
     * cached payload. Live updates invalidate the PanelMentions tag so
     * new threads light up icons without a manual refresh.
     */
    listPanelMentions: builder.query<PanelMentionsResponse, ResourceVersionArgs>({
      query: ({ resourceKind, resourceUID }) => ({
        url: `/resources/${encodeURIComponent(resourceKind)}/${encodeURIComponent(resourceUID)}/panel-mentions`,
      }),
      providesTags: (_r, _e, args) => [{ type: 'PanelMentions', id: `${args.resourceKind}:${args.resourceUID}` }],
    }),

    /**
     * Resolves the unique commenters on a resource into avatar-ready
     * rows for the per-resource "Users" filter dropdown. Cached by
     * `${resourceKind}:${resourceUID}` and invalidated on the live
     * channel + every write that could change the participant set
     * (createThread, addPulse, deleteThread, deletePulse).
     */
    listParticipants: builder.query<ParticipantsResponse, ResourceVersionArgs>({
      query: ({ resourceKind, resourceUID }) => ({
        url: `/resources/${encodeURIComponent(resourceKind)}/${encodeURIComponent(resourceUID)}/participants`,
      }),
      providesTags: (_r, _e, args) => [{ type: 'Participants', id: `${args.resourceKind}:${args.resourceUID}` }],
    }),
  }),
});

export const {
  useListThreadsQuery,
  useListAllThreadsQuery,
  useListFolderRollupThreadsQuery,
  useGetThreadQuery,
  useListPulsesQuery,
  useCreateThreadMutation,
  useDeleteThreadMutation,
  useCloseThreadMutation,
  useReopenThreadMutation,
  useAddPulseMutation,
  useAddAssistantReplyMutation,
  useEditPulseMutation,
  useDeletePulseMutation,
  useSubscribeMutation,
  useUnsubscribeMutation,
  useMarkReadMutation,
  useGetResourceVersionQuery,
  useListPanelMentionsQuery,
  useListParticipantsQuery,
} = pulseApi;
