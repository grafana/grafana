import { type SceneObject, type SceneObjectState } from '@grafana/scenes';

/**
 * Development-only guard for catching dashboard UI state changes that bypass
 * Dashboard Edit Actions (and therefore undo/redo).
 *
 * How it works:
 * - The edit pane wraps every action's `perform`/`undo` with `runWithinEditAction`,
 *   which raises a global "inside an edit action" marker for the duration of the call.
 * - Scene-object classes whose state should only change through Dashboard Edit Actions
 *   are annotated with `@DashboardUI`. That patches their `setState` so that, in
 *   development, a call made while the marker is down logs a `console.warn` with a
 *   stack trace pointing at the offending call site.
 *
 * This is a no-op in production builds (the decorator returns the class untouched).
 */

const ENABLED = process.env.NODE_ENV !== 'production';

/** Prototypes already patched, so repeated `DashboardUI(...)` calls are no-ops. */
const guardedPrototypes = new WeakSet<object>();

let editActionDepth = 0;

/**
 * Marks `fn` as running inside a Dashboard Edit Action (perform/undo), so that
 * setState calls made by `@DashboardUI` objects during it are considered valid.
 * Re-entrant (handles batched/nested actions).
 */
export function runWithinEditAction<T>(fn: () => T): T {
  editActionDepth++;
  try {
    return fn();
  } finally {
    editActionDepth--;
  }
}

function isWithinEditAction(): boolean {
  return editActionDepth > 0;
}

interface SceneObjectClass {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- decorator must accept any scene-object constructor shape
  new (...args: any[]): SceneObject;
  prototype: SceneObject;
}

/**
 * Marks a scene-object class so that, in development, calling `setState` on its
 * instances outside of a Dashboard Edit Action logs a warning. No-op in production.
 *
 * Two ways to use it:
 *
 * As a decorator on classes you own:
 *   @DashboardUI
 *   export class MyLayoutManager extends SceneObjectBase<MyState> { ... }
 *
 * As a runtime call for classes you don't own (e.g. from @grafana/scenes) — it
 * patches the prototype the same way, and affects existing instances too:
 *   DashboardUI(SceneVariableSet);
 *
 * Idempotent: applying it to the same class more than once is a no-op.
 */
export function DashboardUI<T extends SceneObjectClass>(target: T): T {
  if (!ENABLED) {
    return target;
  }

  const proto = target.prototype;

  if (guardedPrototypes.has(proto)) {
    return target;
  }
  guardedPrototypes.add(proto);

  const originalSetState = proto.setState;

  // Shadow setState on this class's prototype so only its instances (and
  // subclasses that don't override setState) are guarded.
  proto.setState = function (this: SceneObject, update: Partial<SceneObjectState>): void {
    if (!isWithinEditAction()) {
      // eslint-disable-next-line no-console
      console.warn(
        `[DashboardUI] ${this.constructor.name}.setState was called outside of a Dashboard Edit Action. ` +
          `Dashboard UI state changes should go through dashboardEditActions to keep undo/redo working.`,
        new Error('setState call site')
      );
    }

    originalSetState.call(this, update);
  };

  return target;
}
