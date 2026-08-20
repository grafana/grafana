import { css, keyframes } from '@emotion/css';
import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  safePolygon,
  useFloating,
  useHover,
  useInteractions,
  useMergeRefs,
} from '@floating-ui/react';
import React, { cloneElement, createContext, useContext, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Portal, useStyles2 } from '@grafana/ui';

type EditActionsPopoverProps = {
  content: React.ReactNode;
  children: React.JSX.Element;
  placement?: Placement;
};

export function EditActionsPopover({ isEditable, ...props }: EditActionsPopoverProps & { isEditable: boolean }) {
  if (!isEditable) {
    return props.children;
  }

  return <HoverPopover {...props} />;
}

export const WAIT_FOR_MOUSE_REST_DURATION_MS = 225;

const EditActionsPopoverContext = createContext<{ closePopover: () => void }>({ closePopover: () => {} });

/**
 * Lets popover content close the popover programmatically, e.g. before opening a modal on top of it.
 */
export const useEditActionsPopover = () => useContext(EditActionsPopoverContext);

function HoverPopover({ content, children, placement = 'top-start' }: EditActionsPopoverProps) {
  const styles = useStyles2(getPopoverStyles);
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [
      offset(0),
      flip({
        mainAxis: false,
        fallbackPlacements: ['top-start', 'top-end'],
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    handleClose: safePolygon(),
    // waits until the user’s cursor is at rest over the reference element before opening
    restMs: WAIT_FOR_MOUSE_REST_DURATION_MS,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);
  // Keep a ref already set on the child (e.g. DashboardGridItem.containerRef).
  const mergedRef = useMergeRefs([refs.setReference, children.props.ref]);

  const popoverContextValue = useMemo(() => ({ closePopover: () => setIsOpen(false) }), []);

  return (
    <>
      {cloneElement(children, getReferenceProps({ ref: mergedRef }))}
      {isOpen && content && (
        <Portal>
          <div ref={refs.setFloating} style={floatingStyles} className={styles.popover} {...getFloatingProps()}>
            <EditActionsPopoverContext.Provider value={popoverContextValue}>
              {/* Stops pointerdown from all actions reaching ancestors, e.g. element selection.
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
    zIndex: theme.zIndex.portal,
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
