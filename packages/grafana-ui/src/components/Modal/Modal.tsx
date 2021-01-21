import React, { FC, PropsWithChildren, useCallback } from 'react';
import { Portal } from '../Portal/Portal';
import { cx } from 'emotion';
import { useTheme } from '../../themes';
import { IconName } from '../../types';
import { getModalStyles } from './getModalStyles';
import { ModalHeader } from './ModalHeader';
import { IconButton } from '../IconButton/IconButton';

export interface Props {
  icon?: IconName;
  iconTooltip?: string;
  /** Title for the modal or custom header element */
  title: string | JSX.Element;
  className?: string;
  contentClassName?: string;

  isOpen?: boolean;
  onDismiss?: () => void;

  /** If not set will call onDismiss if that is set. */
  onClickBackdrop?: () => void;
}

export function Modal(props: PropsWithChildren<Props>): ReturnType<FC<Props>> {
  const {
    title,
    children,
    isOpen = false,
    className,
    contentClassName,
    onDismiss: propsOnDismiss,
    onClickBackdrop,
  } = props;
  const theme = useTheme();
  const styles = getModalStyles(theme);
  const onDismiss = useCallback(() => {
    if (propsOnDismiss) {
      propsOnDismiss();
    }
  }, [propsOnDismiss]);

  if (!isOpen) {
    return null;
  }

  return (
    <Portal>
      <div className={cx(styles.modal, className)}>
        <div className={styles.modalHeader}>
          {typeof title === 'string' && <DefaultModalHeader {...props} title={title} />}
          {typeof title !== 'string' && title}
          <div className={styles.modalHeaderClose}>
            <IconButton surface="header" name="times" size="lg" onClick={onDismiss} />
          </div>
        </div>
        <div className={cx(styles.modalContent, contentClassName)}>{children}</div>
      </div>
      <div className={styles.modalBackdrop} onClick={onClickBackdrop || onDismiss} />
    </Portal>
  );
}

interface DefaultModalHeaderProps {
  title: string;
  icon?: IconName;
  iconTooltip?: string;
}

function DefaultModalHeader({ icon, iconTooltip, title }: DefaultModalHeaderProps): JSX.Element {
  return <ModalHeader icon={icon} iconTooltip={iconTooltip} title={title} />;
}
