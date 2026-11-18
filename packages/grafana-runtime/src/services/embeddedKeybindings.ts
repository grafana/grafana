import { type Observable } from 'rxjs';

/** A Grafana shortcut available to trusted plugins that host embedded content. @public */
export interface EmbeddedKeybinding {
  readonly id: string;
  /** Mousetrap notation. Spaces separate chords and `mod` selects the platform modifier. */
  readonly keys: string;
  readonly allowInEditable: boolean;
}

/** The shortcuts currently active in Grafana's host context. @public */
export interface EmbeddedKeybindingsSnapshot {
  readonly revision: number;
  readonly bindings: readonly EmbeddedKeybinding[];
}

/** Observes and invokes Grafana shortcuts that opt in to embedded use. @public */
export interface EmbeddedKeybindingService {
  /** Emits the current snapshot on subscription and a new revision when the active bindings change. */
  readonly snapshots: Observable<EmbeddedKeybindingsSnapshot>;
  /**
   * Invokes a binding from the current snapshot. Returns false for stale or unavailable bindings.
   * The plugin must verify the user pressed the shortcut in its active embed before invoking it.
   */
  invoke(id: string, revision: number): boolean;
}

let service: EmbeddedKeybindingService | undefined;

/** Returns the embedded shortcut service after Grafana initializes it. @public */
export function getEmbeddedKeybindings(): EmbeddedKeybindingService | undefined {
  return service;
}

/** @internal */
export function setEmbeddedKeybindings(instance: EmbeddedKeybindingService): void {
  service = instance;
}
