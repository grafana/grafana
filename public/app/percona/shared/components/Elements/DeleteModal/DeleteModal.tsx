import React, { FC } from 'react';
import { withTypes } from 'react-final-form';

import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';

import { Messages } from './DeleteModal.messages';
import { getStyles } from './DeleteModal.styles';
import { DeleteModalFormProps, DeleteModalProps } from './DeleteModal.types';

const { defaultTitle, defaultMessage, defaultConfirm, defaultCancel } = Messages;
const { Form } = withTypes<DeleteModalFormProps>();

export const DeleteModal: FC<React.PropsWithChildren<DeleteModalProps>> = ({
  title,
  message,
  confirm,
  cancel,
  isVisible,
  loading,
  showForce,
  forceLabel = Messages.force,
  initialForceValue = false,
  cancelButtondataTestId = 'cancel-delete-modal-button',
  confirmButtondataTestId = 'confirm-delete-modal-button',
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
              <Button
                variant="secondary"
                size="md"
                onClick={() => setVisible(false)}
                data-testid={cancelButtondataTestId}
              >
                {cancel || defaultCancel}
              </Button>
              <LoaderButton
                type="submit"
                loading={loading}
                variant="destructive"
                size="md"
                data-testid={confirmButtondataTestId}
              >
                {confirm || defaultConfirm}
              </LoaderButton>
            </HorizontalGroup>
          </form>
        )}
      />
    </Modal>
  );
};
