/**
 * Undo-domain registry.
 *
 * Each `MutationCommand` may declare an `undoDomain` (e.g. 'variables').
 * The registry maps a domain name to two pure functions:
 *
 *   - `snapshot(scene)`: capture the current state of the slice.
 *   - `restore(scene, snapshot)`: replay the slice back onto the scene.
 *
 * `DashboardMutationClient` consults this registry instead of switching on
 * the domain literal. Adding a new domain (panels, layout, annotations, ...)
 * is one `registerUndoDomain` call from the owning module; the client class
 * does not change.
 */

import type { DashboardScene } from '../scene/DashboardScene';

import { replaceVariableSet } from './commands/variableUtils';

export interface UndoDomainHandler<TSnapshot = unknown> {
  readonly name: string;
  snapshot(scene: DashboardScene): TSnapshot;
  restore(scene: DashboardScene, snapshot: TSnapshot): void;
}

const _registry = new Map<string, UndoDomainHandler<unknown>>();

export function registerUndoDomain<TSnapshot>(handler: UndoDomainHandler<TSnapshot>): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: handler is keyed by name
  _registry.set(handler.name, handler as UndoDomainHandler<unknown>);
}

export function getUndoDomain(name: string): UndoDomainHandler<unknown> | undefined {
  return _registry.get(name);
}

// Built-in: variables domain.
registerUndoDomain({
  name: 'variables',
  snapshot: (scene) => scene.state.$variables?.state.variables.slice() ?? [],
  restore: (scene, snapshot) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- snapshot shape is owned by this domain
    replaceVariableSet(scene, snapshot as ReturnType<UndoDomainHandler['snapshot']> as never);
  },
});
