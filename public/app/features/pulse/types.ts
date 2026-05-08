// Types mirror pkg/services/pulse models. Hand-maintained because the
// backend doesn't (yet) ship CUE/OpenAPI generated TS for this domain.
// Keep this file in sync with pkg/services/pulse/models.go and body.go.

export type ResourceKind = 'dashboard';

export type MentionKind = 'user' | 'panel';

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
