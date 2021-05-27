import React, { FC } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { CheckboxField, LoaderButton, Modal } from '@percona/platform-core';
import { withTypes } from 'react-final-form';
import { DeleteModalProps, DeleteModalFormProps } from './DeleteModal.types';
import { getStyles } from './DeleteModal.styles';
import { Messages } from './DeleteModal.messages';

const { defaultTitle, defaultMessage, defaultConfirm, defaultCancel } = Messages;
const { Form } = withTypes<DeleteModalFormProps>();

export const DeleteModal: FC<DeleteModalProps> = ({
  title,
  message,
  confirm,
  cancel,
  isVisible,
  loading,
  showForce,
  forceLabel = Messages.force,
  initialForceValue = false,
  cancelButtonDataQa = 'cancel-delete-modal-button',
  confirmButtonDataQa = 'confirm-delete-modal-button',
  children,
  setVisible,
  onDelete,
}) => {
  const styles = useStyles(getStyles);

  return (
    <Modal title={title || defaultTitle} isVisible={isVisible} onClose={() => setVisible(false)}>
      <h4 className={styles.deleteModalContent}>{message || defaultMessage}</h4>
      {children}
      <Form
        onSubmit={({ force }) => onDelete(force)}
        render={({ handleSubmit }) => (
          <form onSubmit={handleSubmit}>
            {showForce && <CheckboxField name="force" label={forceLabel} initialValue={initialForceValue} />}
            <HorizontalGroup justify="space-between" spacing="md">
              <Button variant="secondary" size="md" onClick={() => setVisible(false)} data-qa={cancelButtonDataQa}>
                {cancel || defaultCancel}
              </Button>
              <LoaderButton loading={loading} variant="destructive" size="md" data-qa={confirmButtonDataQa}>
                {confirm || defaultConfirm}
              </LoaderButton>
            </HorizontalGroup>
          </form>
        )}
      />
    </Modal>
  );
};
