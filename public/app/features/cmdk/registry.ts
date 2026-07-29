import { useSyncExternalStore } from 'react';

import { type CmdkSource } from './types';

/**
 * Holds the sources the palette queries. Sources can be registered dynamically at any time, by core code or
 * (later, through a plugin extension type) by plugins.
 */
export class CmdkSourceRegistry {
  private sources: CmdkSource[] = [];
  private listeners = new Set<() => void>();

  register(source: CmdkSource): () => void {
    this.sources = [...this.sources, source];
    this.notify();
    return () => {
      this.sources = this.sources.filter((existing) => existing !== source);
      this.notify();
    };
  }

  // Returns a stable reference between changes so it can be used as a useSyncExternalStore snapshot.
  getSources(): CmdkSource[] {
    return this.sources;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const cmdkSourceRegistry = new CmdkSourceRegistry();

export function registerCmdkSource(source: CmdkSource): () => void {
  return cmdkSourceRegistry.register(source);
}

export function useCmdkSources(): CmdkSource[] {
  return useSyncExternalStore(
    (listener) => cmdkSourceRegistry.subscribe(listener),
    () => cmdkSourceRegistry.getSources()
  );
}
