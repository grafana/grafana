import { cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import { PropsWithChildren, useRef } from 'react';
import * as React from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { IconButton } from '../IconButton/IconButton';
import { Stack } from '../Layout/Stack/Stack';

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
  const styles = useStyles2(getModalStyles);

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
              <IconButton
                name="times"
                size="xl"
                onClick={onDismiss}
                aria-label={t('grafana-ui.modal.close-tooltip', 'Close')}
              />
            </div>
          </div>
          <div className={cx(styles.modalContent, contentClassName)}>{children}</div>
        </div>
      </FocusScope>
    </OverlayContainer>
  );
}

function ModalButtonRow({ leftItems, children }: { leftItems?: React.ReactNode; children: React.ReactNode }) {
  const styles = useStyles2(getModalStyles);

  if (leftItems) {
    return (
      <div className={styles.modalButtonRow}>
        <Stack justifyContent="space-between">
          <Stack justifyContent="flex-start" gap={2}>
            {leftItems}
          </Stack>
          <Stack justifyContent="flex-end" gap={2}>
            {children}
          </Stack>
        </Stack>
      </div>
    );
  }

  return (
    <div className={styles.modalButtonRow}>
      <Stack justifyContent="flex-end" gap={2} wrap="wrap">
        {children}
      </Stack>
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
