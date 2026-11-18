import { type ExtensionSidebarAPI } from '@grafana/data';
import {
  canFloatExtensionSidebar,
  canPlaceExtensionSidebar,
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
  // Absent while placements are off, so an extension keeps the controls it shows on a core without them. Read when
  // the extension reads them, after the flags load.
  get subscribeToPopOut() {
    return canPlaceExtensionSidebar() ? subscribeToPopOut : undefined;
  },
  get trackPopOut() {
    return canPlaceExtensionSidebar() ? trackPopOut : undefined;
  },
  get getPlacement() {
    return canPlaceExtensionSidebar() ? getPlacement : undefined;
  },
  get setPlacement() {
    return canPlaceExtensionSidebar() ? setPlacement : undefined;
  },
  get subscribeToPlacement() {
    return canPlaceExtensionSidebar() ? subscribeToPlacement : undefined;
  },
};

function subscribeToPopOut(listener: () => void): () => void {
  if (typeof listener !== 'function') {
    return () => {};
  }
  return subscribeToExtensionSidebarPopOut(listener);
}

function trackPopOut(popIn: () => void): () => void {
  if (typeof popIn !== 'function') {
    return () => {};
  }
  return trackExtensionSidebarPopOut(popIn);
}

function getPlacement(): ExtensionSidebarPlacement {
  return getFloatingExtensionSidebarPlacement();
}

function setPlacement(placement: ExtensionSidebarPlacement): void {
  // Plugins call this from untyped code too; anything else is not a placement.
  if (isPlacement(placement) && canPlaceExtensionSidebar()) {
    setExtensionSidebarPlacement(placement);
  }
}

function subscribeToPlacement(listener: () => void): () => void {
  if (typeof listener !== 'function') {
    return () => {};
  }
  return subscribeToExtensionSidebarPresentation(listener);
}
