import { useSyncExternalStore } from 'react';

/**
 * Module level open/close state so the palette can be toggled from anywhere (top bar trigger, keyboard shortcut)
 * without threading props through the app.
 */
class CmdkVisibility {
  private open = false;
  private listeners = new Set<() => void>();

  isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean) {
    if (this.open === open) {
      return;
    }
    this.open = open;
    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const cmdkVisibility = new CmdkVisibility();

export function openCmdk() {
  cmdkVisibility.setOpen(true);
}

export function closeCmdk() {
  cmdkVisibility.setOpen(false);
}

export function toggleCmdk() {
  cmdkVisibility.setOpen(!cmdkVisibility.isOpen());
}

export function useCmdkVisible(): boolean {
  return useSyncExternalStore(
    (listener) => cmdkVisibility.subscribe(listener),
    () => cmdkVisibility.isOpen()
  );
}
