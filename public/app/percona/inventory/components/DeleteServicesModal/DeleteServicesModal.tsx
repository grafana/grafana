import React, { FC, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { Alert, Button, Checkbox, Modal } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { removeServicesAction } from 'app/percona/shared/core/reducers/services';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';

import { Messages } from './DeleteServicesModal.messages';
import { DeleteServicesModalProps } from './DeleteServicesModal.types';

const DeleteServicesModal: FC<DeleteServicesModalProps> = ({ isOpen, onDismiss, onSuccess, services }) => {
  const [forceModeActive, setForceActive] = useState(false);
  const dispatch = useAppDispatch();

  const handleDelete = async () => {
    const servicesToDelete = services.map((s) => s.original);

    try {
      const params = servicesToDelete.map((s) => ({
        serviceId: s.serviceId,
        force: forceModeActive,
      }));
      const successfullyDeleted = await dispatch(removeServicesAction({ services: params })).unwrap();

      if (successfullyDeleted > 0) {
        appEvents.emit(AppEvents.alertSuccess, [
          Messages.servicesDeleted(successfullyDeleted, servicesToDelete.length),
        ]);
      }

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
    onDismiss();
  };

  return (
    <Modal title={Messages.title} isOpen={isOpen} onDismiss={handleDismiss}>
      <Alert title={Messages.warning} severity="warning" />
      <p data-testid="delete-services-description">{Messages.deleteConfirmation(services.length)}</p>
      <div>
        <Checkbox
          data-testid="delete-services-force-mode"
          label={Messages.forceMode.label}
          description={Messages.forceMode.description}
          value={forceModeActive}
          onChange={() => setForceActive((active) => !active)}
        />
      </div>
      <Modal.ButtonRow>
        <Button data-testid="delete-services-confirm" onClick={handleDelete}>
          {Messages.submit(services.length)}
        </Button>
        <Button data-testid="delete-services-cancel" variant="secondary" onClick={handleDismiss}>
          {Messages.cancel}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export default DeleteServicesModal;
