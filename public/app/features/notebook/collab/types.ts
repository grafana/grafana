import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

export interface CollabUser {
  login: string;
  name: string;
  avatarUrl?: string;
}

interface CollabMessageBase {
  /** Session id of the sender — one per open editor tab, used to ignore own messages. */
  sid: string;
  /**
   * For doc messages: the document's version timestamp (the edit that produced it),
   * used for last-write-wins convergence. For everything else: the send time.
   */
  ts: number;
  user: CollabUser;
}

/** Full working-copy broadcast, sent debounced after local edits and in reply to `hello`. */
interface CollabDocMessage extends CollabMessageBase {
  t: 'doc';
  spec: NotebookSpec;
  /** Sent by one-shot flows (e.g. add-to-notebook) — not a session; skip presence tracking. */
  transient?: boolean;
}

/** Cursor position in notebook-document coordinates plus the cell the user is in. */
interface CollabCursorMessage extends CollabMessageBase {
  t: 'cursor';
  x: number;
  y: number;
  /** Element name of the cell being edited or hovered, null when outside any cell. */
  cellKey: string | null;
}

/** Sent on join and as heartbeat so peers can discover each other. */
interface CollabHelloMessage extends CollabMessageBase {
  t: 'hello';
}

/** Sent on leave for immediate presence cleanup (heartbeat expiry is the fallback). */
interface CollabByeMessage extends CollabMessageBase {
  t: 'bye';
}

/** Sender's viewport position (the cell nearest its center), powering follow mode. */
interface CollabViewMessage extends CollabMessageBase {
  t: 'view';
  cellKey: string | null;
}

/** A human-readable edit event ("added a text block") for the activity feed. */
interface CollabActivityMessage extends CollabMessageBase {
  t: 'activity';
  label: string;
  cellKey?: string;
}

export type CollabMessage =
  | CollabDocMessage
  | CollabCursorMessage
  | CollabHelloMessage
  | CollabByeMessage
  | CollabViewMessage
  | CollabActivityMessage;

export interface RemotePeer {
  sid: string;
  user: CollabUser;
  color: string;
  lastSeen: number;
  cursor?: { x: number; y: number; ts: number };
  cellKey?: string | null;
  /** Cell nearest the peer's viewport center — where followers scroll to. */
  viewCell?: string | null;
}

/** One entry of the session's activity feed (own actions included). */
export interface ActivityEvent {
  id: string;
  sid: string;
  user: CollabUser;
  color: string;
  label: string;
  cellKey?: string;
  ts: number;
}
