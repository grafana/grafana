// Extracted from shared.ts to avoid circular dependency through DashboardScene.
import { BusEventWithPayload } from '@grafana/data';
import { type SceneObject } from '@grafana/scenes';

/**
 * Generic serializable inverse representation: a named operation plus its
 * input payload. Structurally compatible with `MutationRequest` from
 * `mutation-api/types.ts` and with any future bus operation shape.
 *
 * Defined locally to keep `edit-pane/events.ts` free of `mutation-api`
 * imports. Callers that already have a `MutationRequest` can pass it via
 * `satisfies SerializableInverse`.
 */
export interface SerializableInverse {
  /** Operation name (e.g. 'ADD_VARIABLE', 'REMOVE_PANEL'). */
  type: string;
  /** Operation payload, schema-validatable by the operation's owner. */
  payload: unknown;
}

export interface DashboardEditActionEventPayload {
  removedObject?: SceneObject;
  addedObject?: SceneObject;
  movedObject?: SceneObject;
  source: SceneObject;
  description?: string;
  perform: () => void;
  undo: () => void;
  /**
   * Optional serializable inverse. Populated by callers that can express
   * their reverse mutation as data (Mutation API commands, future bus
   * operations, declarative command classes). When present, the action can
   * be reconstructed, audited, or replayed without relying on the closure
   * captured in `undo`.
   *
   * Optional and additive. Existing callers that pass only `perform` and
   * `undo` callbacks (e.g. ad-hoc edits in layout managers) need no change.
   * As more callers populate this field, audit/replay coverage grows
   * monotonically without committing to one undo architecture.
   */
  inverse?: SerializableInverse;
}

export class DashboardEditActionEvent extends BusEventWithPayload<DashboardEditActionEventPayload> {
  static type = 'dashboard-edit-action';
}

/**
 * Emitted after DashboardEditActionEvent has been processed (or undone)
 */
export class DashboardStateChangedEvent extends BusEventWithPayload<{ source: SceneObject }> {
  static type = 'dashboard-state-changed';
}
