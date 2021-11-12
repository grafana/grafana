import React, { PropsWithChildren, useCallback, useEffect } from 'react';
import { Portal } from '../Portal/Portal';
import { cx } from '@emotion/css';
import { useTheme2 } from '../../themes';
import { IconName } from '../../types';
import { getModalStyles } from './getModalStyles';
import { ModalHeader } from './ModalHeader';
import { IconButton } from '../IconButton/IconButton';
import { HorizontalGroup } from '../Layout/Layout';
import FocusTrap from 'focus-trap-react';

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

  /** prevents users from tabbing away from items outside of the modal. You probably want this set to true, but making this opt-in for now as we test out this implementation */
  shouldFocusTrap?: boolean;
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
    shouldFocusTrap,
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
      <MaybeFocusTrap shouldFocusTrap={shouldFocusTrap || false}>
        <div className={cx(styles.modal, className)}>
          <div className={headerClass}>
            {typeof title === 'string' && <DefaultModalHeader {...props} title={title} />}
            {typeof title !== 'string' && title}
            <div className={styles.modalHeaderClose}>
              <IconButton aria-label="Close dialogue" surface="header" name="times" size="xl" onClick={onDismiss} />
            </div>
          </div>
          <div className={cx(styles.modalContent, contentClassName)}>{children}</div>
        </div>
      </MaybeFocusTrap>
    </Portal>
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
  title: string;
  icon?: IconName;
  iconTooltip?: string;
}

function DefaultModalHeader({ icon, iconTooltip, title }: DefaultModalHeaderProps): JSX.Element {
  return <ModalHeader icon={icon} iconTooltip={iconTooltip} title={title} />;
}

/* 
Focus Trap ensures that when a user opens a modal, their keyboard focus jumps to the first
tabbable component available within the modal, and that the user is not able to navigate away 
from the modal until they close it. Probably all modals should support this, but we have 2 concerns
regarding this implementation, we'd like to see fixed before forcing this change on every modal. 
For now focus traps can be opt-in until we have an implementation that feels stable. 
https://github.com/focus-trap/focus-trap/issues/375
https://github.com/focus-trap/focus-trap/issues/383
*/
function MaybeFocusTrap(props: PropsWithChildren<{ shouldFocusTrap: boolean }>) {
  if (props.shouldFocusTrap) {
    return <FocusTrap>{props.children}</FocusTrap>;
  }
  return <>{props.children}</>;
}
