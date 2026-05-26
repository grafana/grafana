/**
 * MutationRecorder
 *
 * Owns the undo/redo stack for a dashboard. All mutations the client executes
 * land here; nothing else carries history state.
 *
 * Design intent (Ivan, 2026-05-26): the recorder is the single source of truth
 * for "what happened to this dashboard". Snapshot + publish-to-toolbar is too
 * many seams. Instead:
 *
 *   - record() pushes an undo entry with before/after snapshots per undoDomain
 *     and clears the redo stack,
 *   - undo() / redo() pop and re-apply,
 *   - UI buttons and the agent both go through the same path: the UNDO and
 *     REDO mutation commands dispatch into this recorder.
 *
 * No DashboardEditActionEvent publication from here. If a separate audit
 * surface needs to react, it subscribes to the recorder, not the other way
 * around.
 */

import type { DashboardScene } from '../scene/DashboardScene';

import type { UndoDomain } from './commands/types';
import { getUndoDomain } from './undo-domains';

export interface RecordOptions {
  type: string;
  payload: unknown;
  undoDomains: UndoDomain[];
  canCoalesceWith?: (previousPayload: unknown, gapMs: number) => boolean;
}

interface StackEntry {
  type: string;
  payload: unknown;
  before: Map<UndoDomain, unknown>;
  after: Map<UndoDomain, unknown>;
  publishedAt: number;
}

export class MutationRecorder {
  private scene: DashboardScene;
  private undoStack: StackEntry[] = [];
  private redoStack: StackEntry[] = [];

  constructor(scene: DashboardScene) {
    this.scene = scene;
  }

  /**
   * Snapshot the declared domains, run the mutation, snapshot again, push
   * onto the undo stack. The caller passes the actual mutation as a function
   * so the recorder can frame it with snapshot/restore.
   */
  async record<T>(opts: RecordOptions, mutate: () => Promise<T>): Promise<T> {
    const before = this.snapshot(opts.undoDomains);
    const result = await mutate();

    if (opts.undoDomains.length === 0) {
      return result;
    }

    const now = Date.now();

    // Coalesce with the previous entry if eligible (e.g. rapid typing).
    const prev = this.undoStack[this.undoStack.length - 1];
    if (prev && prev.type === opts.type && opts.canCoalesceWith?.(prev.payload, now - prev.publishedAt) === true) {
      prev.after = this.snapshot(opts.undoDomains);
      prev.payload = opts.payload;
      prev.publishedAt = now;
      this.redoStack.length = 0;
      return result;
    }

    this.undoStack.push({
      type: opts.type,
      payload: opts.payload,
      before,
      after: this.snapshot(opts.undoDomains),
      publishedAt: now,
    });
    this.redoStack.length = 0;
    return result;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Restore the last entry's `before` snapshots. Refuses if the dashboard has
   * drifted from the entry's `after` state (i.e. something else mutated the
   * same slice in the meantime).
   */
  undo(): boolean {
    const entry = this.undoStack[this.undoStack.length - 1];
    if (!entry) {
      return false;
    }
    if (!this.sliceMapEqual(this.snapshot([...entry.after.keys()]), entry.after)) {
      console.warn(`[mutation-api] refusing undo for ${entry.type}: slice drifted`);
      return false;
    }
    for (const [domain, snap] of entry.before) {
      this.restoreDomain(domain, snap);
    }
    this.undoStack.pop();
    this.redoStack.push(entry);
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack[this.redoStack.length - 1];
    if (!entry) {
      return false;
    }
    if (!this.sliceMapEqual(this.snapshot([...entry.before.keys()]), entry.before)) {
      console.warn(`[mutation-api] refusing redo for ${entry.type}: slice drifted`);
      return false;
    }
    for (const [domain, snap] of entry.after) {
      this.restoreDomain(domain, snap);
    }
    this.redoStack.pop();
    this.undoStack.push(entry);
    return true;
  }

  private snapshot(domains: UndoDomain[]): Map<UndoDomain, unknown> {
    const m = new Map<UndoDomain, unknown>();
    for (const d of domains) {
      m.set(d, this.snapshotDomain(d));
    }
    return m;
  }

  private snapshotDomain(domain: UndoDomain): unknown {
    return getUndoDomain(domain)?.snapshot(this.scene);
  }

  private restoreDomain(domain: UndoDomain, snapshot: unknown): void {
    getUndoDomain(domain)?.restore(this.scene, snapshot);
  }

  private sliceMapEqual(a: Map<UndoDomain, unknown>, b: Map<UndoDomain, unknown>): boolean {
    if (a.size !== b.size) {
      return false;
    }
    for (const [key, valA] of a) {
      const valB = b.get(key);
      if (!sliceEqual(valA, valB)) {
        return false;
      }
    }
    return true;
  }
}

function sliceEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
