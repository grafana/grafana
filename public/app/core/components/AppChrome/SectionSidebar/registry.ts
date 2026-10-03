import { useSyncExternalStore } from 'react';

import { logWarning } from '@grafana/runtime';

import { type SectionSidebarDefinition } from './types';

const definitions = new Map<string, SectionSidebarDefinition>();
const listeners = new Set<() => void>();
// A new array per change gives useSyncExternalStore a stable snapshot between changes
let snapshot: SectionSidebarDefinition[] = [];

function emitChange() {
  snapshot = Array.from(definitions.values());
  listeners.forEach((listener) => listener());
}

/**
 * Registers a section sidebar. Returns a function that unregisters it.
 */
export function registerSectionSidebar(definition: SectionSidebarDefinition): () => void {
  if (definitions.has(definition.id)) {
    logWarning('Unable to register section sidebar, id must be unique', { id: definition.id });
    return () => undefined;
  }

  definitions.set(definition.id, definition);
  emitChange();

  return () => {
    if (definitions.get(definition.id) === definition) {
      definitions.delete(definition.id);
      emitChange();
    }
  };
}

export function getSectionSidebarById(id: string): SectionSidebarDefinition | undefined {
  return definitions.get(id);
}

export function getSectionSidebarForNavId(navId: string | undefined): SectionSidebarDefinition | undefined {
  if (!navId) {
    return undefined;
  }
  return snapshot.find((definition) => definition.navIds.includes(navId));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders when a definition is registered or removed */
export function useSectionSidebarDefinitions(): SectionSidebarDefinition[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}
