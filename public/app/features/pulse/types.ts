// Types mirror pkg/services/pulse models. Hand-maintained because the
// backend doesn't (yet) ship CUE/OpenAPI generated TS for this domain.
// Keep this file in sync with pkg/services/pulse/models.go and body.go.

/**
 * ResourceKind enumerates the kinds of resources a Pulse thread can
 * be attached to. v1 supports `dashboard` only. Folder is
 * intentionally NOT a thread kind: the folder Pulse tab aggregates
 * dashboard-scoped threads from dashboards under a folder rather
 * than holding folder-scoped conversations. Future kinds (alert,
 * SLO, etc.) widen this union without reshaping existing rows.
 */
export type ResourceKind = 'dashboard';

/**
 * MentionKind enumerates the entity types a `@` or `#` chip may
 * reference. Each kind has its own `targetId` namespace:
 *
 *   - `user`      → numeric user id, stringified
 *   - `panel`     → numeric panel id (dashboard-local), stringified
 *   - `dashboard` → dashboard UID (string)
 *   - `time`      → frozen `<fromMs>|<toMs>` epoch range; click pushes
 *                   `from=<ms>&to=<ms>` onto the dashboard URL. The
 *                   backend validates the shape so renderers can
 *                   split on `|` without re-validating.
 *
 * Mirrors `pkg/services/pulse/models.go::MentionKind`. Folder
 * mentions were dropped together with folder-as-a-resource; legacy
 * folder chips persisted in old bodies render through the chip's
 * defensive fallback (a static text span) rather than as a real
 * navigable link. Future kinds (alert rule, SLO, etc.) widen this
 * union without reshaping existing rows.
 */
export type MentionKind = 'user' | 'panel' | 'dashboard' | 'time' | 'webhook';

export type AuthorKind = 'user' | 'service_account';

/**
 * Body carries the human-authored markdown source plus an AST sidecar
 * that records mention metadata for notifications. Bodies authored
 * before markdown support shipped have only `root` populated; the
 * renderer handles both shapes.
 *
 * The AST allowlist is enforced server-side (paragraph / text /
 * mention / link / code / quote / linebreak), and the markdown source
 * is rendered through `renderMarkdown` from `@grafana/data` (which
 * sanitizes via the same xss/DOMPurify pipeline used by the Text
 * panel) so dangerouslySetInnerHTML stays safe.
 */
export interface PulseBody {
  root: PulseBodyNode;
  markdown?: string;
}

export interface PulseBodyNode {
  type: string;
  text?: string;
  url?: string;
  format?: number;
  mention?: PulseMention;
  children?: PulseBodyNode[];
}

export interface PulseMention {
  kind: MentionKind;
  targetId: string;
  displayName?: string;
}

export interface PulseThread {
  uid: string;
  orgId: number;
  resourceKind: ResourceKind;
  resourceUID: string;
  panelId?: number;
  title?: string;
  createdBy: number;
  created: string;
  updated: string;
  lastPulseAt: string;
  pulseCount: number;
  version: number;
  closed?: boolean;
  closedAt?: string;
  closedBy?: number;
  /** First pulse body AST, populated server-side for the thread list. */
  previewBody?: PulseBody;
  /** Display info for the thread starter, server-resolved. */
  authorName?: string;
  authorLogin?: string;
  authorAvatarUrl?: string;
  /** Resource title (e.g. dashboard title) — only set on the global overview. */
  resourceTitle?: string;
  /** Parent folder UID for the dashboard this thread is attached to —
   *  populated only by the folder Pulse rollup endpoint so the rollup
   *  table can render a "Folder" column with a navigable link without
   *  a per-row lookup. Other surfaces leave this empty. */
  folderUID?: string;
  /** Parent folder title; companion to `folderUID`. */
  folderTitle?: string;
  /** Whether the requesting user is subscribed to this thread. Only
   *  populated on the single-thread read (GET /threads/{uid}); absent
   *  on list endpoints, which don't compute it. */
  isSubscribed?: boolean;
}

export interface Pulse {
  uid: string;
  threadUID: string;
  parentUID?: string;
  orgId: number;
  authorUserId: number;
  authorKind: AuthorKind;
  bodyText: string;
  body: PulseBody;
  created: string;
  updated: string;
  edited: boolean;
  deleted: boolean;
  authorName?: string;
  authorLogin?: string;
  authorAvatarUrl?: string;
}

export interface CreateThreadResult {
  thread: PulseThread;
  pulse: Pulse;
}

export interface CreateThreadRequest {
  resourceKind: ResourceKind;
  resourceUID: string;
  panelId?: number;
  title?: string;
  body: PulseBody;
}

export interface AddPulseRequest {
  parentUID?: string;
  body: PulseBody;
}

export interface EditPulseRequest {
  body: PulseBody;
}

export interface MarkReadRequest {
  lastReadPulseUID: string;
}

/**
 * PageResult is the standard envelope for both pagination paradigms
 * the backend uses. Cursor-based endpoints (per-thread pulse replay)
 * populate `nextCursor` + `hasMore`; offset-based endpoints (drawer
 * thread list, global overview) populate `page` + `totalCount`. A
 * response uses one paradigm or the other — clients pick based on
 * the endpoint they're calling.
 */
export interface PageResult<T> {
  items: T[];
  /** Cursor-based listings populate this. */
  nextCursor?: string;
  hasMore: boolean;
  /** Offset-paginated listings populate the page index and total count. */
  page?: number;
  totalCount?: number;
}

export interface ResourceVersion {
  resourceKind: ResourceKind;
  resourceUID: string;
  version: number;
  lastPulseAt: string;
}

/**
 * PanelMentionSummary rolls up the open Pulse threads that touch a
 * single panel — either anchored via Thread.panelId or referenced by
 * a #panel mention chip in any pulse. Powers the per-panel mention
 * indicator in the visualization title bar.
 */
export interface PanelMentionSummary {
  panelId: number;
  threadCount: number;
  /** Most-recently-active matching thread; the title-bar icon opens
   *  straight to it when threadCount === 1. */
  latestThreadUID: string;
  latestThreadTitle?: string;
}

export interface PanelMentionsResponse {
  resourceKind: ResourceKind;
  resourceUID: string;
  mentions: PanelMentionSummary[];
}

/**
 * ParticipantSummary is a single user who has authored or replied on
 * any thread for a resource. Powers the "Users" filter dropdown in
 * the per-resource Pulse drawer. Mirrors the backend's
 * ParticipantSummary so the wire shape and the dropdown row share a
 * type.
 */
export interface ParticipantSummary {
  userId: number;
  login?: string;
  name?: string;
  /** Server-resolved gravatar URL; absent for users without an email. */
  avatarUrl?: string;
}

export interface ParticipantsResponse {
  resourceKind: ResourceKind;
  resourceUID: string;
  participants: ParticipantSummary[];
}

/**
 * ResourceUnreadCountResponse is the wire shape returned by
 * `GET /api/pulse/resources/:kind/:uid/unread`. The frontend renders
 * a numeric badge over the dashboard sidebar's Pulse icon when
 * `unreadCount > 0`. The envelope echoes the resource identifier so
 * the cache key on the RTK Query side stays self-describing in
 * Redux DevTools, but the only field that actually drives the UI is
 * the count.
 */
export interface ResourceUnreadCountResponse {
  resourceKind: ResourceKind;
  resourceUID: string;
  unreadCount: number;
}

/**
 * FolderUnreadCountResponse is the wire shape returned by
 * `GET /api/pulse/folders/:folderUID/unread`. The folder isn't a
 * Pulse resource; the count rolls up across every dashboard the
 * caller can read under the folder hierarchy. Powers the
 * `tabCounter` on the folder navmodel's Pulse tab.
 */
export interface FolderUnreadCountResponse {
  folderUID: string;
  unreadCount: number;
}

/**
 * HookType is the transport a Pulse hook delivers over. v1 ships a
 * single `webhook` type; the union widens (slack, teams, ...) without
 * reshaping stored rows. Mirrors `pkg/services/pulse::HookType`.
 */
export type HookType = 'webhook';

/**
 * PulseHook is a named, org-scoped outbound integration that fires when
 * a pulse mentions it. Secrets are write-only: the API never returns
 * `secret`, only `hasSecret` so the edit form can show whether one is
 * configured. Mirrors `pkg/services/pulse::Hook`.
 */
export interface PulseHook {
  uid: string;
  orgId: number;
  name: string;
  type: HookType;
  url: string;
  disabled: boolean;
  createdBy: number;
  created: string;
  updated: string;
  /** True when a signing secret is configured. The secret itself is
   *  never returned by the API. */
  hasSecret: boolean;
}

export interface HooksResponse {
  hooks: PulseHook[];
}

/** Create payload. `secret` is optional; omit for no signing secret. */
export interface CreateHookRequest {
  name: string;
  type: HookType;
  url: string;
  secret?: string;
  disabled?: boolean;
}

/**
 * Update payload. Omit `secret` to keep the stored secret untouched;
 * send an empty string to clear it (matches the backend pointer
 * semantics).
 */
export interface UpdateHookRequest {
  name: string;
  type: HookType;
  url: string;
  secret?: string;
  disabled?: boolean;
}

/** One row in the @-mention picker's hook lookup. */
export interface HookMentionHit {
  uid: string;
  name: string;
  type: HookType;
}

export interface HookMentionsResponse {
  hooks: HookMentionHit[];
}

/** Discriminated union of events the live channel emits. */
export type PulseEventAction =
  | 'thread_created'
  | 'thread_deleted'
  | 'thread_closed'
  | 'thread_reopened'
  | 'pulse_added'
  | 'pulse_edited'
  | 'pulse_deleted';

export interface PulseEvent {
  action: PulseEventAction;
  orgId: number;
  resourceKind: ResourceKind;
  resourceUID: string;
  threadUID: string;
  pulseUID?: string;
  authorUserId?: number;
  at: string;
}
