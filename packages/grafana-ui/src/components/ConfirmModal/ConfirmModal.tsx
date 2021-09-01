import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Modal } from '../Modal/Modal';
import { IconName } from '../../types/icon';
import { Button } from '../Button';
import { useStyles2 } from '../../themes';
import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, Input } from '..';
import { selectors } from '@grafana/e2e-selectors';

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
  /** Text for dismiss button */
  dismissText?: string;
  /** Icon for the modal header */
  icon?: IconName;
  /** Text user needs to fill in before confirming */
  confirmationText?: string;
  /** Text for alternative button */
  alternativeText?: string;
  /** Confirm action callback */
  onConfirm(): void;
  /** Dismiss action callback */
  onDismiss(): void;
  /** Alternative action callback */
  onAlternative?(): void;
}

export const ConfirmModal = ({
  isOpen,
  title,
  body,
  description,
  confirmText,
  confirmationText,
  dismissText = 'Cancel',
  alternativeText,
  icon = 'exclamation-triangle',
  onConfirm,
  onDismiss,
  onAlternative,
}: ConfirmModalProps): JSX.Element => {
  const [disabled, setDisabled] = useState(Boolean(confirmationText));
  const styles = useStyles2(getStyles);
  const onConfirmationTextChange = (event: React.FormEvent<HTMLInputElement>) => {
    setDisabled(confirmationText?.localeCompare(event.currentTarget.value) !== 0);
  };

  return (
    <Modal className={styles.modal} title={title} icon={icon} isOpen={isOpen} onDismiss={onDismiss}>
      <div className={styles.modalText}>
        {body}
        {description ? <div className={styles.modalDescription}>{description}</div> : null}
        {confirmationText ? (
          <div className={styles.modalConfirmationInput}>
            <HorizontalGroup>
              <Input placeholder={`Type ${confirmationText} to confirm`} onChange={onConfirmationTextChange} />
            </HorizontalGroup>
          </div>
        ) : null}
      </div>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onDismiss} fill="outline">
          {dismissText}
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={disabled}
          autoFocus
          aria-label={selectors.pages.ConfirmModal.delete}
        >
          {confirmText}
        </Button>
        {onAlternative ? (
          <Button variant="primary" onClick={onAlternative}>
            {alternativeText}
          </Button>
        ) : null}
      </Modal.ButtonRow>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 500px;
  `,
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
