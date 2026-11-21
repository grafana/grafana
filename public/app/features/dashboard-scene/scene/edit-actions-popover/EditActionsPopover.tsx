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
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { ElementSelectionContext, Portal, useStyles2, useTheme2 } from '@grafana/ui';

export const WAIT_FOR_MOUSE_REST_DURATION_MS = 225;
/** With `grafana.panelActionsPopover` on, every edit actions popover opens this soon, and without a fade. */
export const PANEL_ACTIONS_POPOVER_REST_DURATION_MS = 150;
const POINTER_EVENTS = ['pointermove', 'pointerdown'] as const;

interface EditActionsPopoverContextValue {
  closePopover: () => void;
  /** Holds the popover open while something its content opened elsewhere is in use, e.g. a quick-edit card. */
  holdOpen: (hold: boolean) => void;
  /** The element the popover belongs to, e.g. a panel, for placing what its content opens beside it. */
  getReference: () => Element | null;
}

/**
 * Lets popover content close the popover programmatically, e.g. before opening a modal on top of it, or hold it open.
 */
const EditActionsPopoverContext = createContext<EditActionsPopoverContextValue>({
  closePopover: () => {},
  holdOpen: () => {},
  getReference: () => null,
});
export const useEditActionsPopover = () => useContext(EditActionsPopoverContext);

/**
 * Checks whether the device supports fine-pointer hover (mouse/trackpad).
 * Panels use this guard when selection auto-opens the sidebar, preventing
 * a touch tap from opening both the sidebar and popover.
 * With explicit sidebar opening enabled (`grafana.dashboardSidebarExplicitOpen=true`), panels bypass this guard.
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
  // Read from the client on each render rather than with the hook, so a popover doesn't need an OpenFeatureProvider above it.
  const isActionsPopoverEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelActionsPopover, false);
  const [isOpen, setIsOpen] = useState(false);
  const heldByContentRef = useRef(false);
  // Where the pointer last was while held open, as hover stops reporting once it is ignored.
  const lastPointerTarget = useRef<EventTarget | null>(null);
  const trackPointer = useRef((event: PointerEvent) => {
    lastPointerTarget.current = event.target;
  });

  const isSelectable = Boolean(useContext(ElementSelectionContext)?.enabled);
  const isEnabled = !disabled && (isSelectable || showOutsideEditMode);

  const keepOpenRef = useRef(keepOpen);
  keepOpenRef.current = keepOpen;
  // Hover closes it when the pointer moves to something it opened, which is portaled elsewhere.
  const onOpenChange = useCallback((open: boolean) => {
    if (!open && (keepOpenRef.current || heldByContentRef.current)) {
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
    restMs: isActionsPopoverEnabled ? PANEL_ACTIONS_POPOVER_REST_DURATION_MS : WAIT_FOR_MOUSE_REST_DURATION_MS,
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
      // Hover and focus live in the DOM, so they can only be read here, once the menu has closed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(false);
    }
  }, [keepOpen, isOpen, refs]);

  const popoverContextValue = useMemo(
    () => ({
      closePopover: () => setIsOpen(false),
      holdOpen: (hold: boolean) => {
        if (hold === heldByContentRef.current) {
          return;
        }
        heldByContentRef.current = hold;
        if (hold) {
          lastPointerTarget.current = null;
          POINTER_EVENTS.forEach((type) =>
            window.addEventListener(type, trackPointer.current, { capture: true, passive: true })
          );
          return;
        }
        POINTER_EVENTS.forEach((type) => window.removeEventListener(type, trackPointer.current, { capture: true }));
        // Close now when the pointer left while held open; hover will not report leaving again.
        const target = lastPointerTarget.current;
        const inside =
          target instanceof Node &&
          (refs.domReference.current?.contains(target) || refs.floating.current?.contains(target));
        if (target && !inside) {
          setIsOpen(false);
        }
      },
      getReference: () => (refs.domReference.current instanceof Element ? refs.domReference.current : null),
    }),
    [refs]
  );

  useEffect(() => {
    const listener = trackPointer.current;
    return () => POINTER_EVENTS.forEach((type) => window.removeEventListener(type, listener, { capture: true }));
  }, []);

  const floating = (
    <div
      ref={refs.setFloating}
      style={keyboardAccessible ? { ...floatingStyles, zIndex: zIndex ?? theme.zIndex.portal } : floatingStyles}
      className={isActionsPopoverEnabled ? undefined : styles.popover}
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
        // Passing the child's own props lets the interaction handlers chain with, not replace, its handlers.
        ...getReferenceProps({ ...children.props, ref: mergedRef }),
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
