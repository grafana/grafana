import { type ExtensionSidebarAPI } from '@grafana/data';
import {
  canFloatExtensionSidebar,
  canPlaceExtensionSidebar,
  type ExtensionSidebarPlacement,
  type FloatingExtensionSidebarHeightOptions,
  getFloatingExtensionSidebarPlacement,
  setExtensionSidebarPlacement,
  setExtensionSidebarPresentation,
  setFloatingExtensionSidebarHeightOptions,
  subscribeToExtensionSidebarPopOut,
  subscribeToExtensionSidebarPresentation,
  subscribeToFloatingExtensionSidebarCollapse,
  trackExtensionSidebarPopOut,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

const PLACEMENTS: readonly ExtensionSidebarPlacement[] = ['left', 'right', 'bottom', 'floating'];

function isPlacement(value: unknown): value is ExtensionSidebarPlacement {
  return PLACEMENTS.some((placement) => placement === value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The floating height in what a plugin passed to `setSizing`, which untyped code calls too: without a usable `min`
 * core shows no height handles, and a `collapsed` that is not below `min` is left out.
 */
function toFloatingHeightOptions(sizing: unknown): FloatingExtensionSidebarHeightOptions | null {
  const height = isRecord(sizing) && isRecord(sizing.floating) ? sizing.floating.height : undefined;
  if (!isRecord(height) || !isPositiveNumber(height.min)) {
    return null;
  }
  const minHeight = Math.round(height.min);
  const collapsedHeight = isPositiveNumber(height.collapsed) ? Math.round(height.collapsed) : 0;
  return collapsedHeight > 0 && collapsedHeight < minHeight ? { minHeight, collapsedHeight } : { minHeight };
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
  // Not behind the floating flag: Composer floats the sidebar without it.
  setSizing: (sizing) => {
    setFloatingExtensionSidebarHeightOptions(toFloatingHeightOptions(sizing));
  },
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
