import { css } from '@emotion/css';
import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  autoUpdate,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Text, getPortalContainer, useStyles2 } from '@grafana/ui';

export const POPOVER_DEFAULT_SIZE = { width: 800, height: 480 };
export const POPOVER_MIN_SIZE = { width: 320, height: 240 };

interface PopoverSize {
  width: number;
  height: number;
}

// Module level on purpose: it outlives the popover and page navigation within the SPA, and resets on refresh
let lastSize: PopoverSize | undefined;

/** @internal for tests */
export function resetStoredSize() {
  lastSize = undefined;
}

export interface ScopesSelectorPopoverProps {
  /** Element the popover is anchored to. It opens right underneath it. */
  anchor: HTMLElement | null;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A resizable, anchored (not movable) floating window. It blocks interaction with the rest of the UI until it is
 * dismissed with Escape or a click outside of it, and remembers the size the user gave it.
 */
export function ScopesSelectorPopover({ anchor, title, onClose, children }: ScopesSelectorPopoverProps) {
  const styles = useStyles2(getStyles);
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<PopoverSize | undefined>(undefined);

  const { context, refs, elements, floatingStyles } = useFloating({
    open: true,
    placement: 'bottom-start',
    elements: { reference: anchor },
    middleware: [offset(4), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });

  const dismiss = useDismiss(context, {
    // Tooltips and menus rendered inside the tree live in the portal container, outside of this element. The overlay
    // itself lives there too, and pressing it is what should dismiss the popover.
    outsidePress: (event) => {
      const target = event.target;
      if (!(target instanceof Node) || target === overlayRef.current) {
        return true;
      }
      return !getPortalContainer().contains(target) || getPortalContainer() === document.body;
    },
  });
  const role = useRole(context, { role: 'dialog' });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  const initialSize = useRef(lastSize ?? POPOVER_DEFAULT_SIZE).current;

  // Remember on close rather than on every resize tick. The native resize handle writes inline width and height to
  // the element, so what we need is the last measured size.
  useEffect(() => {
    // The portal mounts after the first render, so wait for the element to exist
    const element = elements.floating;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      sizeRef.current = { width: element.offsetWidth, height: element.offsetHeight };
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (sizeRef.current) {
        lastSize = sizeRef.current;
      }
    };
  }, [elements.floating]);

  return (
    <FloatingPortal root={getPortalContainer()}>
      <FloatingOverlay ref={overlayRef} lockScroll className={styles.overlay}>
        <FloatingFocusManager context={context} modal getInsideElements={() => [getPortalContainer()]}>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, width: initialSize.width, height: initialSize.height }}
            className={styles.popover}
            aria-labelledby={titleId}
            data-testid="scopes-selector-popover"
            {...getFloatingProps()}
          >
            <div className={styles.header}>
              <Text element="h3" id={titleId} truncate>
                {title}
              </Text>
              <Button
                icon="times"
                size="sm"
                variant="secondary"
                onClick={onClose}
                tooltip={t('scopes.selector.popover.close', 'Close')}
              />
            </div>
            <div className={styles.content}>{children}</div>
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Transparent: only there to keep the rest of the UI from receiving clicks while the popover is open
  overlay: css({
    background: 'transparent',
    zIndex: theme.zIndex.modal,
  }),
  popover: css({
    // The native handle sits in the bottom-right corner, which matches the top-left anchoring
    resize: 'both',
    overflow: 'auto',
    minWidth: POPOVER_MIN_SIZE.width,
    minHeight: POPOVER_MIN_SIZE.height,
    maxWidth: 'calc(100vw - 16px)',
    maxHeight: 'calc(100vh - 80px)',
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    padding: theme.spacing(2),
  }),
  content: css({
    flex: 1,
    minHeight: 0,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  }),
});
