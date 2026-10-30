import { css, cx, keyframes } from '@emotion/css';
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  type OffsetOptions,
  type Placement,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
} from '@floating-ui/react';
import React, {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMedia } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ElementSelectionContext, Portal, useStyles2, useTheme2 } from '@grafana/ui';

export const WAIT_FOR_MOUSE_REST_DURATION_MS = 225;

/**
 * Lets popover content close the popover programmatically, e.g. before opening a modal on top of it.
 */
const EditActionsPopoverContext = createContext<{ closePopover: () => void }>({ closePopover: () => {} });
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
  /** Also shows the popover while element selection is disabled (view mode). */
  showOutsideEditMode?: boolean;
  offset?: OffsetOptions;
  /** Keeps the popover open, e.g. while a menu opened from its content is showing in another portal. */
  keepOpen?: boolean;
  /**
   * Opens the popover on keyboard focus within the reference, closes it on Escape or outside press,
   * and keeps its content in the tab order after the reference.
   */
  keyboardAccessible?: boolean;
  /**
   * Also opens the popover when the reference is tapped on a touch screen. Hover alone only opens it when the browser
   * happens to send compatibility mouse events for the tap.
   */
  openOnTap?: boolean;
  /** Exposes the actions as a labelled toolbar. */
  ariaLabel?: string;
  /** Extra class for the actions container, e.g. to change its spacing. */
  actionsClassName?: string;
};

/**
 * By default the popover is displayed only while element selection is enabled (edit mode).
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
  offset: offsetOptions = 0,
  keepOpen = false,
  keyboardAccessible = false,
  openOnTap = false,
  ariaLabel,
  actionsClassName,
}: EditActionsPopoverProps) {
  const theme = useTheme2();
  const styles = useStyles2(getPopoverStyles);
  const [isOpen, setIsOpen] = useState(false);

  const isSelectable = Boolean(useContext(ElementSelectionContext)?.enabled);
  const isEnabled = !disabled && (isSelectable || showOutsideEditMode);

  const keepOpenRef = useRef(keepOpen);
  keepOpenRef.current = keepOpen;
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
      offset(offsetOptions),
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
  const focus = useFocus(context, { enabled: isEnabled && keyboardAccessible, visibleOnly: true });
  // Touch only: keyboard opening is handled by useFocus, and the default key handlers would swallow Space and Enter
  // for every control inside the reference.
  const tap = useClick(context, {
    enabled: isEnabled && openOnTap,
    ignoreMouse: true,
    toggle: false,
    keyboardHandlers: false,
  });
  const dismiss = useDismiss(context, { enabled: isEnabled && (keyboardAccessible || openOnTap) });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, tap, dismiss]);
  // Keep a ref already set on the child (e.g. DashboardGridItem.containerRef).
  const mergedRef = useMergeRefs([refs.setReference, children.props.ref]);

  // Once a menu opened from the popover closes, close the popover too unless it is still in use.
  const wasKeptOpenRef = useRef(keepOpen);
  useEffect(() => {
    const wasKeptOpen = wasKeptOpenRef.current;
    wasKeptOpenRef.current = keepOpen;
    if (!wasKeptOpen || keepOpen || !isOpen) {
      return;
    }
    const isInUse = [refs.domReference.current, refs.floating.current].some(
      (element) => element?.matches(':hover') || element?.contains(document.activeElement)
    );
    if (!isInUse) {
      setIsOpen(false);
    }
  }, [keepOpen, isOpen, refs]);

  const popoverContextValue = useMemo(() => ({ closePopover: () => setIsOpen(false) }), []);

  const floating = (
    <div
      ref={refs.setFloating}
      style={keyboardAccessible ? { ...floatingStyles, zIndex: zIndex ?? theme.zIndex.portal } : floatingStyles}
      className={styles.popover}
      data-testid={selectors.components.EditActionsPopover.container}
      {...getFloatingProps({ id: context.floatingId })}
    >
      <EditActionsPopoverContext.Provider value={popoverContextValue}>
        {/* Stops pointerdown from all actions reaching ancestors, e.g. to prevent an element selection.
        It cannot live on the icon buttons because their wrapping Tooltip overrides their pointerdown handlers */}
        <div
          className={cx(styles.actions, actionsClassName)}
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          role={ariaLabel ? 'toolbar' : undefined}
          aria-label={ariaLabel}
        >
          {content}
        </div>
      </EditActionsPopoverContext.Provider>
    </div>
  );

  const showPopover = isEnabled && isOpen && content;

  return (
    <>
      {cloneElement(children, {
        ...getReferenceProps({ ref: mergedRef }),
        'data-edit-actions-id': context.floatingId,
      })}
      {showPopover && keyboardAccessible && (
        // FloatingPortal keeps the portalled content in the tab order right after the reference.
        <FloatingPortal root={portalRoot?.()}>
          {/* Closing with focus inside, e.g. via Escape, returns focus to the reference. Hover closes don't move focus. */}
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            {floating}
          </FloatingFocusManager>
        </FloatingPortal>
      )}
      {showPopover && !keyboardAccessible && (
        <Portal root={portalRoot?.()} zIndex={zIndex ?? theme.zIndex.portal}>
          {floating}
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
