import React, { FC, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { Alert, Button, Checkbox, Modal } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { removeServiceAction, RemoveServiceParams } from 'app/percona/shared/core/reducers/services';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';

import { Messages } from './DeleteServiceModal.messages';
import { DeleteServiceModalProps } from './DeleteServiceModal.types';

const DeleteServiceModal: FC<DeleteServiceModalProps> = ({ serviceId, serviceName, isOpen, onCancel, onSuccess }) => {
  const [forceModeActive, setForceActive] = useState(false);
  const dispatch = useAppDispatch();

  const handleDelete = async () => {
    try {
      const params: RemoveServiceParams = {
        serviceId: serviceId,
        force: forceModeActive,
      };

      await dispatch(removeServiceAction(params)).unwrap();

      appEvents.emit(AppEvents.alertSuccess, [Messages.success(serviceName)]);

      setForceActive(false);
      onSuccess();
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
  };

  const handleDismiss = () => {
    setForceActive(false);
    onCancel();
  };

  return (
    <Modal isOpen={isOpen} title={Messages.title} onDismiss={handleDismiss}>
      <Alert title={Messages.warning} severity="warning" />
      <p data-testid="delete-service-description">{Messages.description(serviceName)}</p>
      <div>
        <Checkbox
          data-testid="delete-service-force-mode"
          label={Messages.forceMode.label}
          description={Messages.forceMode.description}
          checked={forceModeActive}
          value={forceModeActive}
          onChange={() => setForceActive((active) => !active)}
        />
      </div>
      <Modal.ButtonRow>
        <Button data-testid="delete-service-confirm" onClick={handleDelete}>
          {Messages.submit}
        </Button>
        <Button data-testid="delete-service-cancel" variant="secondary" onClick={handleDismiss}>
          {Messages.cancel}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export default DeleteServiceModal;
