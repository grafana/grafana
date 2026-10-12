import { css, keyframes } from '@emotion/css';
import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  safePolygon,
  shift,
  useFloating,
  useHover,
  useInteractions,
  useMergeRefs,
} from '@floating-ui/react';
import React, { cloneElement, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useMedia } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { ElementSelectionContext, Portal, useStyles2, useTheme2 } from '@grafana/ui';

export const WAIT_FOR_MOUSE_REST_DURATION_MS = 225;

/**
 * Lets popover content close the popover programmatically, e.g. before opening a modal on top of it,
 * or keep it open while something rendered outside of it (e.g. a dropdown menu) is in use.
 */
const EditActionsPopoverContext = createContext<{ closePopover: () => void; setKeepOpen: (keepOpen: boolean) => void }>(
  { closePopover: () => {}, setKeepOpen: () => {} }
);
export const useEditActionsPopover = () => useContext(EditActionsPopoverContext);

/**
 * Checks whether the device supports fine-pointer hover (mouse/trackpad).
 * On touch, a panel tap opens both the hover popover and the edit sidebar at once.
 * Used for panels only: the popover would cover the sidebar that PanelChrome auto-opens; variable/annotation/link controls are fine without this guard.
 */
export function useHoverPopoverSupported(defaultValue = true) {
  return useMedia('(hover: hover) and (pointer: fine)', defaultValue);
}

type EditActionsPopoverProps = {
  content: React.ReactNode;
  children: React.JSX.Element;
  disabled?: boolean;
  placement?: Placement;
  portalRoot?: () => HTMLElement | undefined;
  zIndex?: number;
  shiftPadding?: () => number | { right: number };
  /** Show the popover outside of edit mode too. */
  showOutsideEditMode?: boolean;
};

/**
 * The popover is displayed only while element selection is enabled (edit mode), unless `showOutsideEditMode` is set.
 * Pass `disabled` to turn it off without unmounting children.
 */
export function EditActionsPopover({
  content,
  children,
  disabled = false,
  placement = 'top-start',
  portalRoot,
  zIndex,
  shiftPadding,
  showOutsideEditMode = false,
}: EditActionsPopoverProps) {
  const theme = useTheme2();
  const styles = useStyles2(getPopoverStyles);
  const [isOpen, setIsOpen] = useState(false);
  // Hover moving into a portal outside the popover (e.g. its dropdown menu) would otherwise close it, unmounting that portal
  const keepOpenRef = useRef(false);

  const isSelectable = Boolean(useContext(ElementSelectionContext)?.enabled);
  const isEnabled = !disabled && (isSelectable || showOutsideEditMode);

  const onOpenChange = useCallback((open: boolean) => {
    if (!open && keepOpenRef.current) {
      return;
    }
    setIsOpen(open);
  }, []);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange,
    placement,
    middleware: [
      offset(0),
      flip({
        mainAxis: false,
        fallbackPlacements: ['top-start', 'top-end'],
      }),
      // Derivable options run when floating-ui computes (popover open), not on every panel render.
      shift(() => ({
        crossAxis: false,
        padding: shiftPadding?.() ?? 0,
      })),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    enabled: isEnabled,
    handleClose: safePolygon(),
    // waits until the user’s cursor is at rest over the reference element before opening
    restMs: WAIT_FOR_MOUSE_REST_DURATION_MS,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);
  // Keep a ref already set on the child (e.g. DashboardGridItem.containerRef).
  const mergedRef = useMergeRefs([refs.setReference, children.props.ref]);

  const popoverContextValue = useMemo(
    () => ({
      closePopover: () => {
        keepOpenRef.current = false;
        setIsOpen(false);
      },
      setKeepOpen: (keepOpen: boolean) => {
        keepOpenRef.current = keepOpen;
      },
    }),
    []
  );

  return (
    <>
      {cloneElement(children, getReferenceProps({ ref: mergedRef }))}
      {isEnabled && isOpen && content && (
        <Portal root={portalRoot?.()} zIndex={zIndex ?? theme.zIndex.portal}>
          <div ref={refs.setFloating} style={floatingStyles} className={styles.popover} {...getFloatingProps()}>
            <EditActionsPopoverContext.Provider value={popoverContextValue}>
              {/* Stops pointerdown from all actions reaching ancestors, e.g. to prevent an element selection.
              It cannot live on the icon buttons because their wrapping Tooltip overrides their pointerdown handlers */}
              <div className={styles.actions} onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}>
                {content}
              </div>
            </EditActionsPopoverContext.Provider>
          </div>
        </Portal>
      )}
    </>
  );
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    [theme.transitions.handleMotion('no-preference')]: {
      animationName: keyframes({
        from: { opacity: 0 },
        to: { opacity: 1 },
      }),
      animationDuration: `${theme.transitions.duration.enteringScreen}ms`,
      animationTimingFunction: theme.transitions.easing.easeOut,
      animationFillMode: 'forwards',
    },
    [theme.transitions.handleMotion('reduce')]: {
      opacity: 1, // skip animation for reduced motion
    },
  }),
  actions: css({
    display: 'flex',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.components.dropdown.background,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z2,
    position: 'relative',
    top: '2px',
  }),
});
