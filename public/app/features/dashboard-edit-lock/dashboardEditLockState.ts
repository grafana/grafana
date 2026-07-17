/**
 * Tiny app-level store for "the dashboard is being edited programmatically"
 * locks.
 *
 * While at least one lock is held, DashboardEditLockHost dims the content
 * area (excluding the extension sidebar) and blocks all pointer interaction,
 * showing a small progress pill in the bottom-left corner. This protects the
 * open dashboard from concurrent manual edits while an agent (e.g. the
 * assistant's dashboard builder) is mutating the live scene — concurrent
 * edits corrupt the dashboard.
 *
 * Locks are reentrant in the counter sense: each acquire adds an entry and
 * the overlay stays up until every entry is released. The most recently
 * acquired entry drives the pill's label, status line, and Cancel action.
 * Releasing is idempotent. Locks live in memory only, so a page reload
 * clears them; holders are expected to release in a `finally`.
 */

export interface DashboardEditLockOptions {
  /** What is happening, e.g. "Building your dashboard". */
  label?: string;
  /** When provided, the pill offers a Cancel button that invokes it. */
  onCancel?: () => void;
}

export interface DashboardEditLockHandle {
  /** Releases the lock. Idempotent. */
  release(): void;
  /** Updates the short status line shown next to the spinner. */
  setStatus(status: string): void;
}

export interface DashboardEditLockEntry {
  id: number;
  label?: string;
  status?: string;
  onCancel?: () => void;
}

/** Dev-only warning threshold for locks that look leaked. */
const LOCK_HELD_WARNING_MS = 10 * 60 * 1000;

let nextId = 1;
let locks: DashboardEditLockEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function acquireDashboardEditLock(options: DashboardEditLockOptions = {}): DashboardEditLockHandle {
  const id = nextId++;
  locks = [...locks, { id, label: options.label, onCancel: options.onCancel }];
  notify();

  const warnTimeout =
    process.env.NODE_ENV === 'development'
      ? window.setTimeout(() => {
          console.warn(
            `Dashboard edit lock "${options.label ?? id}" has been held for over ${LOCK_HELD_WARNING_MS / 60000} minutes — did the holder forget to release it?`
          );
        }, LOCK_HELD_WARNING_MS)
      : undefined;

  return {
    release: () => {
      if (!locks.some((lock) => lock.id === id)) {
        return;
      }
      window.clearTimeout(warnTimeout);
      locks = locks.filter((lock) => lock.id !== id);
      notify();
    },
    setStatus: (status: string) => {
      const lock = locks.find((entry) => entry.id === id);
      if (!lock || lock.status === status) {
        return;
      }
      locks = locks.map((entry) => (entry.id === id ? { ...entry, status } : entry));
      notify();
    },
  };
}

/** The current lock entries; the overlay shows while this is non-empty. */
export function getDashboardEditLocks(): DashboardEditLockEntry[] {
  return locks;
}

export function subscribeToDashboardEditLocks(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
