import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, Modal } from '@grafana/ui';

import { ErrorModal } from '../ErrorModal';

import { type MuteTiming, useDeleteMuteTiming } from './useMuteTimings';

export interface DeleteMuteTimingModalProps {
  muteTiming: MuteTiming;
  alertManagerSourceName: string;
  onDismiss: () => void;
}

export const DeleteMuteTimingModal = ({
  muteTiming,
  alertManagerSourceName,
  onDismiss,
}: DeleteMuteTimingModalProps) => {
  const [deleteMuteTiming, deleteMuteTimingState] = useDeleteMuteTiming({ alertmanager: alertManagerSourceName });
  const [deleteError, setDeleteError] = useState<unknown>();
  const isDeleting = deleteMuteTimingState.status === 'loading';

  const handleDismiss = () => {
    if (!isDeleting) {
      onDismiss();
    }
  };

  const handleConfirm = async () => {
    try {
      await deleteMuteTiming.execute({ name: muteTiming?.metadata?.name ?? muteTiming.name });
      onDismiss();
    } catch (error) {
      setDeleteError(error);
    }
  };

  if (deleteError !== undefined) {
    return <ErrorModal isOpen onDismiss={handleDismiss} error={deleteError} />;
  }

  return (
    <Modal
      isOpen
      title={t('alerting.mute-timing-actions-buttons.title-delete-mute-timing', 'Delete mute timing')}
      onDismiss={handleDismiss}
      closeOnBackdropClick={!isDeleting}
      closeOnEscape={!isDeleting}
    >
      <p>
        {t(
          'alerting.mute-timing-actions-button.body-delete-mute-timing',
          'Are you sure you would like to delete "{{muteTiming}}"?',
          { muteTiming: muteTiming.name }
        )}
      </p>
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={handleDismiss} disabled={isDeleting}>
          {t('alerting.common.cancel', 'Cancel')}
        </Button>
        <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
          {isDeleting ? t('alerting.common.deleting', 'Deleting...') : t('alerting.common.delete', 'Delete')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
