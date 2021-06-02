import React, { FC } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { LoaderButton, Modal } from '@percona/platform-core';
import { DeleteModalProps } from './DeleteModal.types';
import { getStyles } from './DeleteModal.styles';
import { Messages } from './DeleteModal.messages';

const { defaultTitle, defaultMessage, defaultConfirm, defaultCancel } = Messages;

export const DeleteModal: FC<DeleteModalProps> = ({
  title,
  message,
  confirm,
  cancel,
  isVisible,
  loading,
  setVisible,
  onDelete,
}) => {
  const styles = useStyles(getStyles);

  return (
    <Modal title={title || defaultTitle} isVisible={isVisible} onClose={() => setVisible(false)}>
      <h4 className={styles.deleteModalContent}>{message || defaultMessage}</h4>
      <HorizontalGroup justify="space-between" spacing="md">
        <Button variant="secondary" size="md" onClick={() => setVisible(false)} data-qa="cancel-delete-modal-button">
          {cancel || defaultCancel}
        </Button>
        <LoaderButton
          loading={loading}
          variant="destructive"
          size="md"
          onClick={onDelete}
          data-qa="confirm-delete-modal-button"
        >
          {confirm || defaultConfirm}
        </LoaderButton>
      </HorizontalGroup>
    </Modal>
  );
};
