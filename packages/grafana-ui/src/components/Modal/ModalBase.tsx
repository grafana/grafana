import { cx } from '@emotion/css';
import { FloatingFocusManager, useDismiss, useFloating, useInteractions, useRole } from '@floating-ui/react';
import { OverlayContainer } from '@react-aria/overlays';
import { type PropsWithChildren } from 'react';

import { useStyles2 } from '../../themes/ThemeContext';
import { getPortalContainer } from '../Portal/Portal';

import { getModalStyles } from './getModalStyles';

export interface ModalBaseProps {
  className?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  trapFocus?: boolean;
  isOpen?: boolean;
  onDismiss?: () => void;
  onClickBackdrop?: () => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function ModalBase({
  children,
  className,
  isOpen = false,
  closeOnEscape = true,
  closeOnBackdropClick = false,
  trapFocus = true,
  onDismiss,
  onClickBackdrop,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: PropsWithChildren<ModalBaseProps>) {
  const styles = useStyles2(getModalStyles);

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
    outsidePress: () => {
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
    <OverlayContainer>
      <div role="presentation" className={styles.modalBackdrop} />
      <FloatingFocusManager context={context} modal={trapFocus} getInsideElements={() => [getPortalContainer()]}>
        <div
          className={cx(styles.modal, className)}
          ref={refs.setFloating}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          {...getFloatingProps()}
        >
          {children}
        </div>
      </FloatingFocusManager>
    </OverlayContainer>
  );
}
