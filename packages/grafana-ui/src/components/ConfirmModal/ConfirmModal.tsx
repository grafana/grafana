import { css, cx } from '@emotion/css';
import React, { useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { IconName } from '../../types/icon';
import { ButtonVariant } from '../Button';
import { Modal } from '../Modal/Modal';

import { ConfirmContent } from './ConfirmContent';

export interface ConfirmModalProps {
  /** Toggle modal's open/closed state */
  isOpen: boolean;
  /** Title for the modal header */
  title: string;
  /** Modal content */
  body: React.ReactNode;
  /** Modal description */
  description?: React.ReactNode;
  /** Text for confirm button */
  confirmText: string;
  /** Variant for confirm button */
  confirmVariant?: ButtonVariant;
  /** Text for dismiss button */
  dismissText?: string;
  /** Variant for dismiss button */
  dismissVariant?: ButtonVariant;
  /** Icon for the modal header */
  icon?: IconName;
  /** Additional styling for modal container */
  modalClass?: string;
  /** Text user needs to fill in before confirming */
  confirmationText?: string;
  /** Text for alternative button */
  alternativeText?: string;
  /** Confirm button variant */
  confirmButtonVariant?: ButtonVariant;
  /** Confirm action callback
   * Return a promise to disable the confirm button until the promise is resolved
   */
  onConfirm(): void | Promise<void>;
  /** Dismiss action callback */
  onDismiss(): void;
  /** Alternative action callback */
  onAlternative?(): void;
}

export const ConfirmModal = ({
  isOpen,
  title,
  modalClass,
  icon = 'exclamation-triangle',
  onDismiss,
  ...rest
}: ConfirmModalProps): JSX.Element => {
  const styles = useStyles2(getStyles);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // for some reason autoFocus property did no work on this button, but this does
    if (isOpen) {
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <Modal className={cx(styles.modal, modalClass)} title={title} icon={icon} isOpen={isOpen} onDismiss={onDismiss}>
      <ConfirmContent {...rest} onDismiss={onDismiss} />
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '500px',
  }),
  modalText: css({
    fontSize: theme.typography.h5.fontSize,
    color: theme.colors.text.primary,
  }),
  modalDescription: css({
    fontSize: theme.typography.body.fontSize,
  }),
  modalConfirmationInput: css({
    paddingTop: theme.spacing(1),
  }),
});
