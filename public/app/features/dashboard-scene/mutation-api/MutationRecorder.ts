/**
 * MutationRecorder
 *
 * Concept: the snapshot + publish-DashboardEditActionEvent mechanism is not
 * the Mutation Client's concern. It is the *recorder*'s concern. By moving
 * it onto DashboardScene we get:
 *
 *   - a single recorder per dashboard regardless of caller (UI, agent, future
 *     headless plugin host),
 *   - a clean seam for the future audit log / replay tooling to read from,
 *   - a per-dashboard ownership boundary that's natural for multiplayer.
 *
 * DashboardMutationClient delegates here. Other callers (the future MCP
 * gateway, plugin-side adapters) can call `recorder.record(...)` directly
 * without owning their own snapshot machinery.
 *
 * The behaviour (snapshot, publish, conflict-detect, coalesce) is identical
 * to what the client did before this extraction.
 */

import type { SceneObject } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../edit-pane/events';
import type { DashboardScene } from '../scene/DashboardScene';

import type { UndoDomain } from './commands/types';
import { getUndoDomain } from './undo-domains';

export interface RecordOptions {
  type: string;
  payload: unknown;
  undoDomains: UndoDomain[];
  canCoalesceWith?: (previousPayload: unknown, gapMs: number) => boolean;
}

interface LastEntry {
  type: string;
  payload: unknown;
  publishedAt: number;
}

export class MutationRecorder {
  private scene: DashboardScene;
  private lastEntry?: LastEntry;

  constructor(scene: DashboardScene) {
    this.scene = scene;
  }

  /**
   * Snapshot the declared domains, run the mutation, snapshot again, and
   * publish a DashboardEditActionEvent so the toolbar undo stack picks it up.
   *
   * The caller passes the actual mutation as a function so the recorder can
   * frame it with snapshot/restore. Returns whatever the mutation returns.
   */
  async record<T>(opts: RecordOptions, mutate: () => Promise<T>): Promise<T> {
    const beforeSnapshots = new Map<UndoDomain, unknown>();
    for (const d of opts.undoDomains) {
      beforeSnapshots.set(d, this.snapshotDomain(d));
    }

    const result = await mutate();

    if (opts.undoDomains.length === 0 || typeof this.scene.publishEvent !== 'function') {
      return result;
    }

    // Coalesce path: skip publishing a fresh entry, update the watermark.
    if (
      this.lastEntry &&
      this.lastEntry.type === opts.type &&
      opts.canCoalesceWith?.(this.lastEntry.payload, Date.now() - this.lastEntry.publishedAt) === true
    ) {
      this.lastEntry = { type: opts.type, payload: opts.payload, publishedAt: Date.now() };
      return result;
    }

    const afterSnapshots = new Map<UndoDomain, unknown>();
    for (const d of opts.undoDomains) {
      afterSnapshots.set(d, this.snapshotDomain(d));
    }

    const primary = opts.undoDomains[0];
    const { addedObject, removedObject } = diffSceneObjects(beforeSnapshots.get(primary), afterSnapshots.get(primary));

    let firstPerform = true;
    this.scene.publishEvent(
      new DashboardEditActionEvent({
        source: this.scene,
        description: opts.type,
        addedObject,
        removedObject,
        perform: () => {
          if (firstPerform) {
            firstPerform = false;
            return;
          }
          for (const d of opts.undoDomains) {
            if (!sliceEqual(this.snapshotDomain(d), beforeSnapshots.get(d))) {
              console.warn(`[mutation-api] refusing redo for ${opts.type}: slice '${d}' drifted`);
              return;
            }
          }
          for (const d of opts.undoDomains) {
            this.restoreDomain(d, afterSnapshots.get(d));
          }
        },
        undo: () => {
          for (const d of opts.undoDomains) {
            if (!sliceEqual(this.snapshotDomain(d), afterSnapshots.get(d))) {
              console.warn(`[mutation-api] refusing undo for ${opts.type}: slice '${d}' drifted`);
              return;
            }
          }
          for (const d of opts.undoDomains) {
            this.restoreDomain(d, beforeSnapshots.get(d));
          }
        },
      }),
      true
    );
    this.lastEntry = { type: opts.type, payload: opts.payload, publishedAt: Date.now() };
    return result;
  }

  private snapshotDomain(domain: UndoDomain): unknown {
    return getUndoDomain(domain)?.snapshot(this.scene);
  }

  private restoreDomain(domain: UndoDomain, snapshot: unknown): void {
    getUndoDomain(domain)?.restore(this.scene, snapshot);
  }
}

function diffSceneObjects(
  before: unknown,
  after: unknown
): {
  addedObject?: SceneObject;
  removedObject?: SceneObject;
} {
  if (!Array.isArray(before) || !Array.isArray(after)) {
    return {};
  }
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.find((item): item is SceneObject => !beforeSet.has(item) && isSceneObjectLike(item));
  const removed = before.find((item): item is SceneObject => !afterSet.has(item) && isSceneObjectLike(item));
  return { addedObject: added, removedObject: removed };
}

function isSceneObjectLike(item: unknown): item is SceneObject {
  return typeof item === 'object' && item !== null && 'state' in item;
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
