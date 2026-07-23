import { type JSX, useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

import { isLoading } from '../../hooks/useAsync';
import { ErrorModal } from '../ErrorModal';

import { type MuteTiming, useDeleteMuteTiming } from './useMuteTimings';

type UseDeleteMuteTimingModal = [modal: JSX.Element, openConfirmModal: () => void, isDeleting: boolean];

/**
 * Controls the delete confirmation and error modals for a single mute timing, exposing the in-flight
 * delete state so the surrounding actions can be disabled while a deletion is running.
 */
export const useDeleteMuteTimingModal = (
  muteTiming: MuteTiming,
  alertManagerSourceName: string
): UseDeleteMuteTimingModal => {
  const [deleteMuteTiming, deleteMuteTimingRequestState] = useDeleteMuteTiming({
    alertmanager: alertManagerSourceName,
  });
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>();

  const openConfirmModal = useCallback(() => setConfirmModalOpen(true), []);
  const closeConfirmModal = useCallback(() => setConfirmModalOpen(false), []);

  const handleConfirm = useCallback(async () => {
    try {
      await deleteMuteTiming.execute({ name: muteTiming?.metadata?.name ?? muteTiming.name });
    } catch (error) {
      setDeleteError(error);
    } finally {
      closeConfirmModal();
    }
  }, [deleteMuteTiming, closeConfirmModal, muteTiming]);

  const modal = useMemo(
    () => (
      <>
        <ConfirmModal
          isOpen={isConfirmModalOpen}
          title={t('alerting.mute-timing-actions-buttons.title-delete-mute-timing', 'Delete mute timing')}
          body={t(
            'alerting.mute-timing-actions-button.body-delete-mute-timing',
            'Are you sure you would like to delete "{{muteTiming}}"?',
            { muteTiming: muteTiming.name }
          )}
          confirmText={t('alerting.common.delete', 'Delete')}
          onConfirm={handleConfirm}
          onDismiss={closeConfirmModal}
        />
        <ErrorModal
          isOpen={deleteError !== undefined}
          onDismiss={() => setDeleteError(undefined)}
          error={deleteError}
        />
      </>
    ),
    [isConfirmModalOpen, deleteError, handleConfirm, closeConfirmModal, muteTiming.name]
  );

  return [modal, openConfirmModal, isLoading(deleteMuteTimingRequestState)];
};
