import { type JSX, useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { ConfirmModal } from '@grafana/ui';

import { isLoading } from '../../hooks/useAsync';
import { ErrorModal } from '../ErrorModal';

import { type MuteTiming, useDeleteMuteTiming } from './useMuteTimings';

type UseDeleteMuteTimingModal = [modal: JSX.Element, showModal: () => void, isDeleting: boolean];

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
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<unknown>();

  const showModal = useCallback(() => setIsOpen(true), []);
  const dismissModal = useCallback(() => setIsOpen(false), []);

  const handleConfirm = useCallback(async () => {
    try {
      await deleteMuteTiming.execute({ name: muteTiming?.metadata?.name ?? muteTiming.name });
    } catch (e) {
      setError(e);
    } finally {
      dismissModal();
    }
  }, [deleteMuteTiming, dismissModal, muteTiming]);

  const modal = useMemo(
    () => (
      <>
        <ConfirmModal
          isOpen={isOpen}
          title={t('alerting.mute-timing-actions-buttons.title-delete-mute-timing', 'Delete mute timing')}
          body={t(
            'alerting.mute-timing-actions-button.body-delete-mute-timing',
            'Are you sure you would like to delete "{{muteTiming}}"?',
            { muteTiming: muteTiming.name }
          )}
          confirmText={t('alerting.common.delete', 'Delete')}
          onConfirm={handleConfirm}
          onDismiss={dismissModal}
        />
        <ErrorModal isOpen={error !== undefined} onDismiss={() => setError(undefined)} error={error} />
      </>
    ),
    [isOpen, error, handleConfirm, dismissModal, muteTiming.name]
  );

  return [modal, showModal, isLoading(deleteMuteTimingRequestState)];
};
