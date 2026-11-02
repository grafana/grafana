import { BehaviorSubject } from 'rxjs';

type PluginLoadState = { status: 'loading' | 'loaded' } | { status: 'failed'; error: Error };

const states = new BehaviorSubject<ReadonlyMap<string, PluginLoadState>>(new Map());
export const pluginLoadStates = states.asObservable();

export function setPluginLoadState(pluginId: string, state: PluginLoadState): void {
  states.next(new Map(states.value).set(pluginId, state));
}

export function clearPluginLoadStates(): void {
  states.next(new Map());
}
