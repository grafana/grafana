import { useState } from 'react';

import { t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

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
  const [deleteMuteTiming] = useDeleteMuteTiming({ alertmanager: alertManagerSourceName });
  const [deleteError, setDeleteError] = useState<unknown>();

  const handleConfirm = async () => {
    try {
      await deleteMuteTiming.execute({ name: muteTiming?.metadata?.name ?? muteTiming.name });
      onDismiss();
    } catch (error) {
      setDeleteError(error);
    }
  };

  if (deleteError !== undefined) {
    return <ErrorModal isOpen onDismiss={onDismiss} error={deleteError} />;
  }

  return (
    <ConfirmModal
      isOpen
      title={t('alerting.mute-timing-actions-buttons.title-delete-mute-timing', 'Delete mute timing')}
      body={t(
        'alerting.mute-timing-actions-button.body-delete-mute-timing',
        'Are you sure you would like to delete "{{muteTiming}}"?',
        { muteTiming: muteTiming.name }
      )}
      confirmText={t('alerting.common.delete', 'Delete')}
      onConfirm={handleConfirm}
      onDismiss={onDismiss}
    />
  );
};
