/** ClientMessage is what clients send to the ops channel. */
export interface ClientMessage {
  kind: 'op' | 'lock' | 'checkpoint';
  op: unknown;
}

/** MutationRequest is the protocol's own representation of a dashboard mutation.
 *  Mirrors the MutationRequest in dashboard-scene/mutation-api/types.ts but defined
 *  locally to keep the wire protocol self-contained. The backend treats the payload
 *  as opaque. */
export interface MutationRequest {
  type: string;
  payload: unknown;
}

/** CollabOperation wraps a DashboardMutationAPI request with collab metadata. */
export interface CollabOperation {
  mutation: MutationRequest;
  lockTarget: string;
}

/** LockOperation requests or releases a panel-level soft lock. */
export interface LockOperation {
  type: 'lock' | 'unlock';
  target: string;
  userId: string;
}

/** CheckpointOperation requests a named version snapshot. */
export interface CheckpointOperation {
  type: 'checkpoint';
  message?: string;
}

/** ServerMessage is what the server broadcasts to all clients. */
export interface ServerMessage {
  seq: number;
  kind: 'op' | 'lock' | 'checkpoint' | 'presence';
  op: unknown;
  userId: string;
  timestamp: number;
}

/** CursorUpdate is ephemeral — sent on the cursors channel only, never hits server logic. */
export interface CursorUpdate {
  type: 'cursor';
  userId: string;
  displayName: string;
  avatarUrl: string;
  color: string;
  x: number;
  y: number;
  panelId?: string;
}
