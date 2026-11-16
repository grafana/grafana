import { type ExtensionSidebarAPI } from '@grafana/data';
import {
  canFloatExtensionSidebar,
  type ExtensionSidebarPlacement,
  getFloatingExtensionSidebarPlacement,
  setExtensionSidebarPlacement,
  setExtensionSidebarPresentation,
  subscribeToExtensionSidebarPopOut,
  subscribeToExtensionSidebarPresentation,
  subscribeToFloatingExtensionSidebarCollapse,
  trackExtensionSidebarPopOut,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

const PLACEMENTS: readonly ExtensionSidebarPlacement[] = ['left', 'right', 'bottom', 'floating'];

function isPlacement(value: unknown): value is ExtensionSidebarPlacement {
  return PLACEMENTS.some((placement) => placement === value);
}

export const extensionSidebarApi: ExtensionSidebarAPI = {
  canFloat: () => canFloatExtensionSidebar(),
  setPresentation: (presentation) => {
    // Plugins call this from untyped code too; anything else is not a layout.
    if (presentation === 'docked' || presentation === 'floating') {
      setExtensionSidebarPresentation(presentation);
    }
  },
  subscribeToCollapse: (listener) => {
    if (typeof listener !== 'function') {
      return () => {};
    }
    return subscribeToFloatingExtensionSidebarCollapse(listener);
  },
  canDragToFloat: () => canFloatExtensionSidebar(),
  subscribeToPopOut: (listener) => {
    if (typeof listener !== 'function') {
      return () => {};
    }
    return subscribeToExtensionSidebarPopOut(listener);
  },
  trackPopOut: (popIn) => {
    if (typeof popIn !== 'function') {
      return () => {};
    }
    return trackExtensionSidebarPopOut(popIn);
  },
  getPlacement: () => getFloatingExtensionSidebarPlacement(),
  setPlacement: (placement) => {
    // Plugins call this from untyped code too; every placement but the right needs floating's flag, as core's menu.
    if (isPlacement(placement) && canFloatExtensionSidebar()) {
      setExtensionSidebarPlacement(placement);
    }
  },
  subscribeToPlacement: (listener) => {
    if (typeof listener !== 'function') {
      return () => {};
    }
    return subscribeToExtensionSidebarPresentation(listener);
  },
};
