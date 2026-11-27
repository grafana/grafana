import { createContext, useCallback, useContext, useEffect, useId, useState } from 'react';

type SetOverlayOpen = (overlayId: string, isOpen: boolean) => void;

const PanelActionsOverlayContext = createContext<SetOverlayOpen | undefined>(undefined);

export const PanelActionsOverlayProvider = PanelActionsOverlayContext.Provider;

/**
 * Tracks overlays (menus, popovers) opened from items in the panel actions popover. They render in their own portal,
 * so pointer and focus moves into them would otherwise close the popover, and unmount them, mid-interaction.
 */
export function usePanelActionsOverlays() {
  const [openOverlays, setOpenOverlays] = useState<ReadonlySet<string>>(() => new Set());

  const setOverlayOpen = useCallback<SetOverlayOpen>((overlayId, isOpen) => {
    setOpenOverlays((current) => {
      if (current.has(overlayId) === isOpen) {
        return current;
      }
      const next = new Set(current);
      if (isOpen) {
        next.add(overlayId);
      } else {
        next.delete(overlayId);
      }
      return next;
    });
  }, []);

  return { hasOpenOverlay: openOverlays.size > 0, setOverlayOpen };
}

/**
 * Reports whether an overlay opened from the panel actions popover is showing, so the popover stays open meanwhile.
 * Does nothing outside the popover.
 */
export function usePanelActionsOverlayOpenChange() {
  const overlayId = useId();
  const setOverlayOpen = useContext(PanelActionsOverlayContext);

  useEffect(() => () => setOverlayOpen?.(overlayId, false), [overlayId, setOverlayOpen]);

  return useCallback((isOpen: boolean) => setOverlayOpen?.(overlayId, isOpen), [overlayId, setOverlayOpen]);
}
