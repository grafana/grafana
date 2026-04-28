// Types mirror pkg/services/pulse models. Hand-maintained because the
// backend doesn't (yet) ship CUE/OpenAPI generated TS for this domain.
// Keep this file in sync with pkg/services/pulse/models.go and body.go.

export type ResourceKind = 'dashboard';

export type MentionKind = 'user' | 'panel';

export type AuthorKind = 'user' | 'service_account';

/**
 * Body is a Lexical-compatible JSON AST. The backend strictly validates
 * the node types so the frontend can render via React data bindings
 * (no dangerouslySetInnerHTML) without a sanitization step.
 */
export interface PulseBody {
  root: PulseBodyNode;
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

export interface PageResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ResourceVersion {
  resourceKind: ResourceKind;
  resourceUID: string;
  version: number;
  lastPulseAt: string;
}

/** Discriminated union of events the live channel emits. */
export type PulseEventAction = 'thread_created' | 'pulse_added' | 'pulse_edited' | 'pulse_deleted';

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
