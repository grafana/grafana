import { t } from '@grafana/i18n';

import { useConfirmModalWithError } from '../ConfirmModalWithError';

import { type MuteTiming, useDeleteMuteTiming } from './useMuteTimings';

export interface UseDeleteMuteTimingModalOptions {
  muteTiming: MuteTiming;
  alertManagerSourceName: string;
}

export const useDeleteMuteTimingModal = ({ muteTiming, alertManagerSourceName }: UseDeleteMuteTimingModalOptions) => {
  const [deleteMuteTiming] = useDeleteMuteTiming({ alertmanager: alertManagerSourceName });

  return useConfirmModalWithError({
    title: t('alerting.mute-timing-actions-buttons.title-delete-mute-timing', 'Delete mute timing'),
    body: (
      <p>
        {t(
          'alerting.mute-timing-actions-button.body-delete-mute-timing',
          'Are you sure you would like to delete "{{muteTiming}}"?',
          { muteTiming: muteTiming.name }
        )}
      </p>
    ),
    onConfirm: () => deleteMuteTiming.execute({ name: muteTiming?.metadata?.name ?? muteTiming.name }),
  });
};
