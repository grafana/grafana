import { css, cx } from '@emotion/css';
import * as React from 'react';

import { IconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { ButtonVariant } from '../Button/Button';
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
  /** Disable the confirm button and the confirm text input if needed */
  disabled?: boolean;
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
  disabled,
}: ConfirmModalProps): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <Modal className={cx(styles.modal, modalClass)} title={title} icon={icon} isOpen={isOpen} onDismiss={onDismiss}>
      <ConfirmContent
        body={body}
        description={description}
        confirmButtonLabel={confirmText}
        dismissButtonLabel={dismissText}
        dismissButtonVariant={dismissVariant}
        confirmPromptText={confirmationText}
        alternativeButtonLabel={alternativeText}
        confirmButtonVariant={confirmButtonVariant}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        onAlternative={onAlternative}
        disabled={disabled}
      />
    </Modal>
  );
};

const getStyles = () => ({
  modal: css({
    width: '500px',
  }),
});
