import { useSyncExternalStore } from 'react';

export interface OpenSidePanelNotebook {
  uid: string;
  title: string;
}

// Module state rather than context: the dashboard panel menu is built outside React, and Explore's
// toolbar sits in a different tree from the sidebar.
let current: OpenSidePanelNotebook | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getOpenSidePanelNotebook(): OpenSidePanelNotebook | undefined {
  return current;
}

export function setOpenSidePanelNotebook(next: OpenSidePanelNotebook): void {
  if (current?.uid === next.uid && current.title === next.title) {
    return;
  }
  current = next;
  emit();
}

export function clearOpenSidePanelNotebook(): void {
  if (current === undefined) {
    return;
  }
  current = undefined;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOpenSidePanelNotebook(): OpenSidePanelNotebook | undefined {
  return useSyncExternalStore(subscribe, getOpenSidePanelNotebook);
}
