import React, { PropsWithChildren, useCallback, useEffect } from 'react';
import { Portal } from '../Portal/Portal';
import { cx } from '@emotion/css';
import { useTheme2 } from '../../themes';
import { IconName } from '../../types';
import { getModalStyles } from './getModalStyles';
import { ModalHeader } from './ModalHeader';
import { IconButton } from '../IconButton/IconButton';
import { HorizontalGroup } from '../Layout/Layout';

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
    onDismiss: propsOnDismiss,
    onClickBackdrop,
  } = props;
  const theme = useTheme2();
  const styles = getModalStyles(theme);
  const onDismiss = useCallback(() => {
    if (propsOnDismiss) {
      propsOnDismiss();
    }
  }, [propsOnDismiss]);

  useEffect(() => {
    const onEscKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Esc' || ev.key === 'Escape') {
        onDismiss();
      }
    };
    if (isOpen && closeOnEscape) {
      document.addEventListener('keydown', onEscKey, false);
    } else {
      document.removeEventListener('keydown', onEscKey, false);
    }
    return () => {
      document.removeEventListener('keydown', onEscKey, false);
    };
  }, [closeOnEscape, isOpen, onDismiss]);

  if (!isOpen) {
    return null;
  }

  const headerClass = cx(styles.modalHeader, typeof title !== 'string' && styles.modalHeaderWithTabs);

  return (
    <Portal>
      <div
        className={styles.modalBackdrop}
        onClick={onClickBackdrop || (closeOnBackdropClick ? onDismiss : undefined)}
      />
      <div className={cx(styles.modal, className)}>
        <div className={headerClass}>
          {typeof title === 'string' && <DefaultModalHeader {...props} title={title} />}
          {typeof title !== 'string' && title}
          <div className={styles.modalHeaderClose}>
            <IconButton surface="header" name="times" size="xl" onClick={onDismiss} />
          </div>
        </div>
        <div className={cx(styles.modalContent, contentClassName)}>{children}</div>
      </div>
    </Portal>
  );
}

function ModalButtonRow({ children }: { children: React.ReactNode }) {
  const theme = useTheme2();
  const styles = getModalStyles(theme);

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
  title: string;
  icon?: IconName;
  iconTooltip?: string;
}

function DefaultModalHeader({ icon, iconTooltip, title }: DefaultModalHeaderProps): JSX.Element {
  return <ModalHeader icon={icon} iconTooltip={iconTooltip} title={title} />;
}
