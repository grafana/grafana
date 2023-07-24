import { cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import React, { PropsWithChildren, useRef } from 'react';

import { useTheme2 } from '../../themes';
import { IconName } from '../../types';
import { IconButton } from '../IconButton/IconButton';
import { HorizontalGroup } from '../Layout/Layout';

import { ModalHeader } from './ModalHeader';
import { getModalStyles } from './getModalStyles';

export interface Props {
  /** @deprecated no longer used */
  icon?: IconName;
  /** @deprecated no longer used */
  iconTooltip?: string;
  /** Title for the modal or custom header element */
  title: string | JSX.Element;
  className?: string;
  contentClassName?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  trapFocus?: boolean;

  isOpen?: boolean;
  onDismiss?: () => void;

  /** If not set will call onDismiss if that is set. */
  onClickBackdrop?: () => void;
}

export function Modal(props: PropsWithChildren<Props>) {
  const {
    title,
    children,
    isOpen = false,
    closeOnEscape = true,
    closeOnBackdropClick = true,
    className,
    contentClassName,
    onDismiss,
    onClickBackdrop,
    trapFocus = true,
  } = props;
  const theme = useTheme2();
  const styles = getModalStyles(theme);

  const ref = useRef<HTMLDivElement>(null);

  // Handle interacting outside the dialog and pressing
  // the Escape key to close the modal.
  const { overlayProps, underlayProps } = useOverlay(
    { isKeyboardDismissDisabled: !closeOnEscape, isOpen, onClose: onDismiss },
    ref
  );

  // Get props for the dialog and its title
  const { dialogProps, titleProps } = useDialog({}, ref);

  if (!isOpen) {
    return null;
  }

  const headerClass = cx(styles.modalHeader, typeof title !== 'string' && styles.modalHeaderWithTabs);

  return (
    <OverlayContainer>
      <div
        role="presentation"
        className={styles.modalBackdrop}
        onClick={onClickBackdrop || (closeOnBackdropClick ? onDismiss : undefined)}
        {...underlayProps}
      />
      <FocusScope contain={trapFocus} autoFocus restoreFocus>
        <div className={cx(styles.modal, className)} ref={ref} {...overlayProps} {...dialogProps}>
          <div className={headerClass}>
            {typeof title === 'string' && <DefaultModalHeader {...props} title={title} id={titleProps.id} />}
            {
              // FIXME: custom title components won't get an accessible title.
              // Do we really want to support them or shall we just limit this ModalTabsHeader?
              typeof title !== 'string' && title
            }
            <div className={styles.modalHeaderClose}>
              <IconButton name="times" size="xl" onClick={onDismiss} tooltip="Close" />
            </div>
          </div>
          <div className={cx(styles.modalContent, contentClassName)}>{children}</div>
        </div>
      </FocusScope>
    </OverlayContainer>
  );
}

function ModalButtonRow({ leftItems, children }: { leftItems?: React.ReactNode; children: React.ReactNode }) {
  const theme = useTheme2();
  const styles = getModalStyles(theme);

  if (leftItems) {
    return (
      <div className={styles.modalButtonRow}>
        <HorizontalGroup justify="space-between">
          <HorizontalGroup justify="flex-start" spacing="md">
            {leftItems}
          </HorizontalGroup>
          <HorizontalGroup justify="flex-end" spacing="md">
            {children}
          </HorizontalGroup>
        </HorizontalGroup>
      </div>
    );
  }

  return (
    <div className={styles.modalButtonRow}>
      <HorizontalGroup justify="flex-end" spacing="md">
        {children}
      </HorizontalGroup>
    </div>
  );
}

Modal.ButtonRow = ModalButtonRow;

interface DefaultModalHeaderProps {
  id?: string;
  title: string;
  icon?: IconName;
  iconTooltip?: string;
}

function DefaultModalHeader({ icon, iconTooltip, title, id }: DefaultModalHeaderProps): JSX.Element {
  return <ModalHeader icon={icon} iconTooltip={iconTooltip} title={title} id={id} />;
}
