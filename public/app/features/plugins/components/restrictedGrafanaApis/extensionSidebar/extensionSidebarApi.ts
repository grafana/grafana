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

/**
 * Plugins call `setFloatingHeightResize` from untyped code too: anything without a usable minimum hides the handles,
 * and a collapsed height that is not below the minimum is left out.
 */
function toHeightOptions(value: unknown): FloatingExtensionSidebarHeightOptions | null {
  if (typeof value !== 'object' || value === null || !('minHeight' in value) || !isPositiveNumber(value.minHeight)) {
    return null;
  }
  const minHeight = Math.round(value.minHeight);
  const collapsedHeight =
    'collapsedHeight' in value && isPositiveNumber(value.collapsedHeight) ? Math.round(value.collapsedHeight) : 0;
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
  setFloatingHeightResize: (options) => {
    setFloatingExtensionSidebarHeightOptions(toHeightOptions(options));
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
