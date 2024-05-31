import { css, cx } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '../../themes';
import { IconName } from '../../types/icon';
import { ButtonVariant } from '../Button';
import { Modal } from '../Modal/Modal';

import { ConfirmContent, ConfirmContentProps } from './ConfirmContent';

export interface ConfirmModalProps extends Omit<ConfirmContentProps, 'fillToConfirmText'> {
  /** Toggle modal's open/closed state */
  isOpen: boolean;
  /** Title for the modal header */
  title: string;
  /** Variant for confirm button */
  confirmVariant?: ButtonVariant;
  /** Icon for the modal header */
  icon?: IconName;
  /** Additional styling for modal container */
  modalClass?: string;
  /** Text user needs to fill in before confirming */
  confirmationText?: string;
}

export const ConfirmModal = ({
  isOpen,
  title,
  body,
  description,
  confirmText,
  confirmVariant = 'destructive',
  confirmationText,
  dismissText = 'Cancel',
  dismissVariant = 'secondary',
  alternativeText,
  modalClass,
  icon = 'exclamation-triangle',
  onConfirm,
  onDismiss,
  onAlternative,
  confirmButtonVariant = 'destructive',
}: ConfirmModalProps): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <Modal className={cx(styles.modal, modalClass)} title={title} icon={icon} isOpen={isOpen} onDismiss={onDismiss}>
      <ConfirmContent
        body={body}
        description={description}
        confirmText={confirmText}
        dismissText={dismissText}
        dismissVariant={dismissVariant}
        fillToConfirmText={confirmationText}
        alternativeText={alternativeText}
        confirmButtonVariant={confirmButtonVariant}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        onAlternative={onAlternative}
      />
    </Modal>
  );
};

const getStyles = () => ({
  modal: css({
    width: '500px',
  }),
});
