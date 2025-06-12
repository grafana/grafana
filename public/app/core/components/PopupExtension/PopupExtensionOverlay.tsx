import { cx } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import { PropsWithChildren, useRef } from 'react';

import { useStyles2 } from '@grafana/ui';
import { getModalStyles } from '@grafana/ui/internal';

interface PopupExtensionOverlayProps extends PropsWithChildren {
  className?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  isOpen?: boolean;
  trapFocus?: boolean;
  onDismiss?: () => void;

  /** If not set will call onDismiss if that is set. */
  onClickBackdrop?: () => void;
}

export const PopupExtensionOverlay = (props: PopupExtensionOverlayProps) => {
  const {
    className,
    children,
    isOpen = false,
    closeOnEscape = true,
    closeOnBackdropClick = true,
    trapFocus = true,
    onDismiss,
    onClickBackdrop,
  } = props;
  const styles = useStyles2(getModalStyles);
  const ref = useRef<HTMLDivElement>(null);

  // Handle interacting outside the dialog and pressing
  // the Escape key to close the modal.
  const { overlayProps, underlayProps } = useOverlay(
    { isKeyboardDismissDisabled: !closeOnEscape, isOpen, onClose: onDismiss },
    ref
  );

  return (
    <OverlayContainer>
      <div
        role="presentation"
        className={styles.modalBackdrop}
        onClick={onClickBackdrop || (closeOnBackdropClick ? onDismiss : undefined)}
        {...underlayProps}
      >
        <FocusScope contain={trapFocus} autoFocus restoreFocus>
          <div className={cx(styles.modal, className)} ref={ref} {...overlayProps}>
            {children}
          </div>
        </FocusScope>
      </div>
    </OverlayContainer>
  );
};
