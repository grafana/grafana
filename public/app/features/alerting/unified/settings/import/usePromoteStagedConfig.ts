import { generatedAPI as notificationsAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useDispatch } from 'app/types/store';

import { logError } from '../../Analytics';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { convertToGMAApi } from '../../api/convertToGMAApi';
import { stringifyErrorLike } from '../../utils/misc';

import { type StagedExtraConfig } from './stagedConfig';

interface UsePromoteStagedConfigResult {
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

/**
 * Promotes a staged Alertmanager config into the live one, then — for auto-sync-managed configs —
 * clears the configured auto-sync datasource UID so the merge doesn't keep getting treated as
 * sync-managed. Reports the outcome via app notifications and calls `onDismiss` once it settles.
 */
export function usePromoteStagedConfig(
  stagedConfig: StagedExtraConfig,
  isSyncManaged: boolean | undefined,
  onDismiss: () => void
): UsePromoteStagedConfigResult {
  const notifyApp = useAppNotification();
  const dispatch = useDispatch();
  const [promote, { isLoading: isPromoting }] = convertToGMAApi.usePromoteAlertmanagerConfigMutation();
  const [updateAlertingConfiguration, { isLoading: isClearingAutoSync }] =
    alertmanagerApi.endpoints.updateGrafanaAlertingConfiguration.useMutation();

  const isSubmitting = isPromoting || isClearingAutoSync;

  /**
   * The sync worker stops on its own once it sees the merge committed, but the configured datasource
   * UID stays on the org config — which keeps auto-sync reported as active and keeps the convert API
   * rejecting notification imports. Clearing it is what actually ends the sync.
   *
   * Reports failure rather than throwing: it runs after an irreversible merge, so it must not be
   * mistaken for a failed promote.
   */
  const clearAutoSync = async (): Promise<boolean> => {
    try {
      await updateAlertingConfiguration({
        // Backend convention: empty string clears the configured UID.
        external_alertmanager_uid: '',
        notificationOptions: { showErrorAlert: false },
      }).unwrap();
      // The UID lives in a different RTKQ slice than the Config resource useIsAutoSyncActive reads,
      // so tag invalidation doesn't cross over on its own.
      dispatch(notificationsAPI.util.invalidateTags(['Config']));
      return true;
    } catch (err) {
      logError(new Error(stringifyErrorLike(err)));
      return false;
    }
  };

  const onConfirm = async () => {
    try {
      await promote({ configIdentifier: stagedConfig.identifier }).unwrap();
    } catch (err) {
      logError(new Error(stringifyErrorLike(err)));
      notifyApp.error(
        t('alerting.settings.import.promote.error-title', 'Failed to promote configuration'),
        stringifyErrorLike(err)
      );
      return;
    }

    // The merge has landed by this point, so nothing below may report the promote as failed.
    if (isSyncManaged && !(await clearAutoSync())) {
      notifyApp.warning(
        t(
          'alerting.settings.import.promote.sync-not-cleared-title',
          'Configuration promoted, but auto-sync is still configured'
        ),
        t(
          'alerting.settings.import.promote.sync-not-cleared-body',
          'Nothing syncs from the datasource any more. Disable auto-sync in Alerting settings to import notification resources again — if it is set in grafana.ini, remove the key there.'
        )
      );
    } else {
      notifyApp.success(
        t('alerting.settings.import.promote.success-title', 'Configuration promoted'),
        t('alerting.settings.import.promote.success-body', 'The imported resources were merged into your live config.')
      );
    }
    onDismiss();
  };

  return { onConfirm, isSubmitting };
}
