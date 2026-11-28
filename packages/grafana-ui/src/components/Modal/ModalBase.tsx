import { cx } from '@emotion/css';
import { FloatingFocusManager, useDismiss, useFloating, useInteractions, useRole } from '@floating-ui/react';
import { OverlayContainer, usePreventScroll } from '@react-aria/overlays';
import { type ComponentProps, type PropsWithChildren, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CSSTransition } from 'react-transition-group';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { pickDataAttributes } from '../../utils/dataAttributes';
import { getPortalContainer, ParentPortalProvider, useParentPortal } from '../Portal/Portal';

import { getModalStyles } from './getModalStyles';

export interface ModalBaseProps {
  className?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  trapFocus?: boolean;
  /**
   * What receives focus when the modal opens: an index into the modal's
   * tabbable elements, or a ref to the element itself. Defaults to the first
   * tabbable element, which is usually the close button. Pass a negative number
   * to leave focus alone — for content that focuses itself, such as an input
   * that autofocuses on mount. The focus trap stays active either way.
   */
  initialFocus?: ComponentProps<typeof FloatingFocusManager>['initialFocus'];
  isOpen?: boolean;
  onDismiss?: () => void;
  onClickBackdrop?: () => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Custom data attributes (for example `data-analytics-id`), rendered on the dialog element */
  [key: `data-${string}`]: string | undefined;
}

export function ModalBase({
  children,
  className,
  isOpen = false,
  closeOnEscape = true,
  closeOnBackdropClick = false,
  trapFocus = true,
  initialFocus,
  onDismiss,
  onClickBackdrop,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...restProps
}: PropsWithChildren<ModalBaseProps>) {
  const dataAttributes = pickDataAttributes(restProps);
  const styles = useStyles2(getModalStyles);
  const theme = useTheme2();
  const backdropRef = useRef<HTMLDivElement>(null);

  // Inside a Portal in another window than this one, such as a Document Picture-in-Picture window, this window's
  // portal container isn't visible. The modal opens in that Portal instead, where the portals inside it render too.
  const parentPortal = useParentPortal();
  const otherWindowPortal = parentPortal != null && parentPortal.ownerDocument !== document ? parentPortal : undefined;
  const getOverlayContainer = () => otherWindowPortal ?? getPortalContainer();
  // There, the portals inside the modal (menus, combobox options, a modal it opens) render into a container of their own
  // next to it. The modal treats that container as inside while it hides the rest of the Portal, the app's own content,
  // from assistive tech. The dialog waits for the container, so those portals mount there once.
  const [nestedPortals, setNestedPortals] = useState<HTMLDivElement | null>(null);

  // It locks this window's page, which isn't the one behind a modal in another window.
  usePreventScroll({ isDisabled: !isOpen || otherWindowPortal != null });

  const { context, refs } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) {
        onDismiss?.();
      }
    },
  });

  const dismiss = useDismiss(context, {
    escapeKey: closeOnEscape,
    outsidePress: (event) => {
      // The portal container is "inside" the modal (see getInsideElements below), so presses
      // there must not dismiss it — except on the backdrop, which also renders there.
      const portalContainer = getOverlayContainer();
      const { Node } = portalContainer.ownerDocument.defaultView ?? window;
      const target = event.target instanceof Node ? event.target : null;
      if (
        target &&
        portalContainer !== document.body &&
        portalContainer.contains(target) &&
        !backdropRef.current?.contains(target)
      ) {
        return false;
      }
      if (onClickBackdrop) {
        onClickBackdrop();
        return false;
      }
      return closeOnBackdropClick;
    },
  });

  const role = useRole(context, {
    role: 'dialog',
  });

  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <OverlayContainer portalContainer={otherWindowPortal}>
        {(!otherWindowPortal || nestedPortals) && (
          <>
            <CSSTransition
              nodeRef={backdropRef}
              in={true}
              appear={true}
              timeout={theme.transitions.duration.standard}
              classNames={{ appear: styles.modalBackdropAppear, appearActive: styles.modalBackdropActive }}
            >
              <div role="presentation" ref={backdropRef} className={styles.modalBackdrop} />
            </CSSTransition>
            <FloatingFocusManager
              context={context}
              modal={trapFocus}
              initialFocus={initialFocus}
              getInsideElements={() => (otherWindowPortal && nestedPortals ? [nestedPortals] : [getPortalContainer()])}
            >
              <CSSTransition
                nodeRef={refs.floating}
                in={true}
                appear={true}
                timeout={theme.transitions.duration.shortest}
                classNames={{ appear: styles.modalAppear, appearActive: styles.modalAppearActive }}
              >
                <div
                  {...dataAttributes}
                  className={cx(styles.modal, className)}
                  ref={refs.setFloating}
                  aria-label={ariaLabel}
                  aria-labelledby={ariaLabelledBy}
                  {...getFloatingProps()}
                >
                  <ParentPortalProvider value={otherWindowPortal ? nestedPortals : parentPortal}>
                    {children}
                  </ParentPortalProvider>
                </div>
              </CSSTransition>
            </FloatingFocusManager>
          </>
        )}
      </OverlayContainer>
      {/* Next to the modal's OverlayContainer, not in it: react-aria throws when a modal inside this one puts its own
       * OverlayContainer in another. And after it: modals share one z-index, so a modal opened from this one shows on
       * top by coming later, as it does in this window's portal container. */}
      {otherWindowPortal && createPortal(<div ref={setNestedPortals} />, otherWindowPortal)}
    </>
  );
}
