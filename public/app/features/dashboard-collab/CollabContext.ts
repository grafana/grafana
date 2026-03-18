/**
 * CollabContext — React context for real-time dashboard collaboration.
 *
 * Provides connection state, active users, panel locks, and lock
 * acquisition/release functions to any component in the dashboard tree.
 */

import { createContext } from 'react';

import type { CursorUpdate } from './protocol/messages';

export interface CollabUser {
  userId: string;
  displayName: string;
  avatarUrl: string;
  color: string;
}

export interface CollabLock {
  target: string;
  userId: string;
}

export interface CollabContextValue {
  /** Whether the collab connection is active. */
  connected: boolean;

  /** Currently connected users (from session state + join/leave events). */
  users: CollabUser[];

  /** Current panel-level locks. */
  locks: CollabLock[];

  /** Lock targets that are stale (held >5min with no ops from holder). */
  staleLocks: Set<string>;

  /** Latest cursor positions from other users. */
  cursors: Map<string, CursorUpdate>;

  /** Acquire a soft lock on a target (e.g. panel ID). */
  acquireLock: (target: string) => void;

  /** Release a soft lock on a target. */
  releaseLock: (target: string) => void;

  /** Send a cursor position update. */
  sendCursor: (update: Omit<CursorUpdate, 'type'>) => void;

  /** Send a checkpoint (manual save) request with an optional version name. */
  sendCheckpoint: (message?: string) => void;
}

const noop = () => {};

export const CollabContext = createContext<CollabContextValue>({
  connected: false,
  users: [],
  locks: [],
  staleLocks: new Set(),
  cursors: new Map(),
  acquireLock: noop,
  releaseLock: noop,
  sendCursor: noop,
  sendCheckpoint: noop,
});
